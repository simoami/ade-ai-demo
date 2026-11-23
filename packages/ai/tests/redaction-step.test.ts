import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import type { OcrPage } from '#stages/ocr/ocr-result'
import type {
  IdentifierSpan,
  RedactionRegion,
} from '#stages/redact/redaction-types'
import {
  decryptArtifact,
  encryptArtifact,
} from '#workflows/ingest-document/artifact-encryption'
import { redactDocument } from '#workflows/ingest-document/redact-document'

const DOCUMENT_ID = 'f5947cf9-48ef-4354-8c39-c1bba1444319'
const key = Buffer.alloc(32, 7)
const region: RedactionRegion = {
  page: 1,
  blockId: 'text',
  box: { x: 0, y: 0, width: 0.5, height: 0.5 },
  points: [
    [0, 0],
    [0.5, 0],
    [0.5, 0.5],
    [0, 0.5],
  ],
  category: 'name',
  state: 'needsReview',
  source: 'text',
}

async function harness(placed: RedactionRegion[] = [region]) {
  const image = await sharp({
    create: { width: 10, height: 10, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer()
  const burned = await sharp({
    create: { width: 10, height: 10, channels: 3, background: 'black' },
  })
    .png()
    .toBuffer()
  const pages: OcrPage[] = [false, true].map((figure) => ({
    blocks: [
      {
        id: figure ? 'figure' : 'text',
        kind: figure ? 'figure' : 'paragraph',
        text: 'Synthetic name',
        box: region.box,
        continues: null,
      },
    ],
    usage: { latencyMs: 1 },
  }))
  const spans: IdentifierSpan[] = [
    {
      page: 1,
      blockId: 'text',
      start: 0,
      end: 9,
      category: 'name',
      confidence: 0.6,
    },
  ]
  const blobs = new Map<string, Buffer>([
    [
      `documents/${DOCUMENT_ID}/ocr.json.enc`,
      encryptArtifact(Buffer.from(JSON.stringify(pages)), key),
    ],
    [
      `documents/${DOCUMENT_ID}/identifiers.json.enc`,
      encryptArtifact(Buffer.from(JSON.stringify(spans)), key),
    ],
    [`documents/${DOCUMENT_ID}/render/1.png`, image],
    [`documents/${DOCUMENT_ID}/render/2.png`, image],
  ])
  const events: string[] = []
  const replacements: Parameters<
    NonNullable<NonNullable<Parameters<typeof redactDocument>[2]>['replace']>
  >[1][] = []
  const deps: NonNullable<Parameters<typeof redactDocument>[2]> = {
    storage: {
      get: async (path) => {
        const bytes = blobs.get(path)
        return bytes
          ? {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes)
                  controller.close()
                },
              }),
              contentType: 'application/octet-stream',
            }
          : null
      },
      put: async (path, body, options) => {
        assert.ok(Buffer.isBuffer(body))
        assert.equal(options.allowOverwrite, true)
        assert.equal(options.addRandomSuffix, false)
        blobs.set(path, body)
        return {
          url: '',
          downloadUrl: '',
          pathname: path,
          contentType: options.contentType ?? '',
          contentDisposition: '',
          etag: '',
        }
      },
    },
    key: () => key,
    update: async (_id, values) => {
      events.push(`status:${values.status}`)
    },
    pictures: async ({ pageNumber }) => {
      events.push(`pictures:${pageNumber}`)
      return []
    },
    place: async ({ pageNumber, width, height }, spans) => {
      assert.equal(width, 10)
      assert.equal(height, 10)
      assert.equal(spans.length, pageNumber === 1 ? 1 : 0)
      events.push(`place:${pageNumber}`)
      return pageNumber === 1 ? placed : []
    },
    burn: async (_image, regions) => {
      events.push(`burn:${regions.length}`)
      return burned
    },
    replace: async (_id, rows) => {
      replacements.push(rows)
      events.push('replace')
    },
    publish: async (_id, images) => {
      assert.deepEqual(images, [burned, burned])
      assert.equal(replacements.at(-1)?.length, placed.length)
      assert.ok(blobs.has(`documents/${DOCUMENT_ID}/redaction/ready.json.enc`))
      events.push('publish')
      blobs.delete(`documents/${DOCUMENT_ID}/render/1.png`)
      blobs.delete(`documents/${DOCUMENT_ID}/render/2.png`)
      return 1
    },
  }
  return { deps, blobs, events, replacements, image }
}

test('places stored spans on all pages, reviews only figures, keeps encrypted sources, replaces rows and publishes burned pixels', async () => {
  const h = await harness()
  assert.deepEqual(await redactDocument(DOCUMENT_ID, 2, h.deps), {
    pageCount: 2,
    spanCount: 1,
    appliedCount: 0,
    needsReviewCount: 1,
  })
  assert.deepEqual(h.events, [
    'status:redacting',
    'place:1',
    'burn:0',
    'pictures:2',
    'place:2',
    'burn:0',
    'replace',
    'publish',
  ])
  for (const page of [1, 2]) {
    const source = h.blobs.get(
      `documents/${DOCUMENT_ID}/redaction/source/${page}.png.enc`
    )
    assert.ok(source)
    assert.deepEqual(decryptArtifact(source, key), h.image)
  }
  const row = h.replacements[0]?.[0]
  assert.match(
    row?.id ?? '',
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  )
  const { source: _source, ...expected } = region
  assert.deepEqual(row, { ...expected, id: row?.id, documentId: DOCUMENT_ID })
})

test('burns only applied regions while persisting candidates needing review', async () => {
  const applied: RedactionRegion = { ...region, state: 'applied' }
  const h = await harness([region, applied])
  const burn = h.deps.burn
  assert.ok(burn)
  const burnedRegions: RedactionRegion[][] = []
  h.deps.burn = async (image, regions) => {
    burnedRegions.push(regions)
    return burn(image, regions)
  }

  assert.deepEqual(await redactDocument(DOCUMENT_ID, 2, h.deps), {
    pageCount: 2,
    spanCount: 1,
    appliedCount: 1,
    needsReviewCount: 1,
  })
  assert.deepEqual(burnedRegions, [[applied], []])
  assert.deepEqual(
    h.replacements[0]?.map(({ state }) => state),
    ['needsReview', 'applied']
  )
})

test('retries from encrypted burned pages after publication deleted renders and replaces identical rows', async () => {
  const h = await harness()
  let attempts = 0
  const publish = h.deps.publish
  assert.ok(publish)
  h.deps.publish = async (...args) => {
    const version = await publish(...args)
    if (++attempts === 1) throw new Error('private cleanup failure')
    return version
  }
  await assert.rejects(redactDocument(DOCUMENT_ID, 2, h.deps), {
    message: 'Document redaction failed',
  })
  assert.equal(h.events.at(-1), 'status:failed')
  await redactDocument(DOCUMENT_ID, 2, h.deps)
  assert.deepEqual(h.replacements[0], h.replacements[1])
  assert.equal(h.events.filter((event) => event === 'place:1').length, 1)
  assert.equal(h.events.at(-1), 'publish')
})

test('marks failed and hides stage errors without publishing or persisting incomplete work', async () => {
  for (const stage of [
    'pictures',
    'place',
    'burn',
    'replace',
    'publish',
  ] as const) {
    const h = await harness()
    h.deps[stage] = async () => {
      throw new Error('synthetic private provider response')
    }
    await assert.rejects(redactDocument(DOCUMENT_ID, 2, h.deps), {
      message: 'Document redaction failed',
    })
    assert.equal(h.events.at(-1), 'status:failed')
    assert.ok(!h.events.includes('publish'))
  }
})

test('rejects missing, unauthenticated and malformed OCR or identifier artifacts before placement', async () => {
  for (const [artifact, bytes] of [
    'ocr.json.enc',
    'identifiers.json.enc',
  ].flatMap((artifact) =>
    [null, Buffer.from('invalid'), encryptArtifact(Buffer.from('{}'), key)].map(
      (bytes) => [artifact, bytes] as const
    )
  )) {
    const h = await harness()
    const path = `documents/${DOCUMENT_ID}/${artifact}`
    if (bytes) h.blobs.set(path, bytes)
    else h.blobs.delete(path)
    await assert.rejects(redactDocument(DOCUMENT_ID, 2, h.deps), {
      message: 'Document redaction failed',
    })
    assert.deepEqual(h.events, ['status:redacting', 'status:failed'])
  }
})
