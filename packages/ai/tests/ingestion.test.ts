import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { test } from 'node:test'
import sharp from 'sharp'
import {
  decryptArtifact,
  encryptArtifact,
  encryptionKey,
} from '#workflows/ingest-document/artifact-encryption'
import {
  completeDocument,
  readDocument,
  renderDocument,
} from '#workflows/ingest-document/processing'
import { startDocumentSchema } from '#workflows/ingest-document/review-action'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'
const key = randomBytes(32)
const input = {
  documentId,
  fileName: 'scan.png',
  pathnames: ['uploads/scan-random.png'],
}

function harness() {
  const blobs = new Map<string, { bytes: Buffer; contentType: string }>()
  const writes: string[] = []
  const updates: Parameters<
    NonNullable<Parameters<typeof completeDocument>[2]>
  >[] = []
  const update = async (
    ...args: Parameters<NonNullable<Parameters<typeof completeDocument>[2]>>
  ) => {
    updates.push(args)
  }
  const storage = {
    get: async (path: string) => {
      const value = blobs.get(path)
      return value
        ? {
            stream: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(value.bytes)
                controller.close()
              },
            }),
            contentType: value.contentType,
          }
        : null
    },
    put: async (
      path: string,
      body: unknown,
      options: {
        contentType: string
        addRandomSuffix?: boolean
        allowOverwrite?: boolean
      }
    ) => {
      assert.ok(Buffer.isBuffer(body))
      assert.equal(options.allowOverwrite, true)
      assert.equal(options.addRandomSuffix, false)
      blobs.set(path, { bytes: body, contentType: options.contentType })
      writes.push(path)
      return {
        url: `https://example.invalid/${path}`,
        downloadUrl: `https://example.invalid/${path}`,
        pathname: path,
        contentType: options.contentType,
        contentDisposition: 'attachment',
        etag: 'test',
      }
    },
  }
  return { blobs, writes, updates, deps: { storage, update, key: () => key } }
}

test('accepts one to thirty upload paths and rejects URLs, traversal, wrong prefixes and extra fields', () => {
  assert.equal(startDocumentSchema.safeParse(input).success, false)
  for (const count of [1, 30])
    assert.equal(
      startDocumentSchema.safeParse({
        fileName: 'scan',
        pathnames: Array.from({ length: count }, (_, i) => `uploads/${i}.png`),
      }).success,
      true
    )
  for (const pathnames of [
    [],
    Array.from({ length: 31 }, () => 'uploads/a'),
    ['documents/a'],
    ['https://example.invalid/uploads/a'],
    ['uploads/../a'],
    ['uploads/%2e%2e/a'],
    ['uploads//a'],
    ['uploads/a?x'],
    ['uploads/a\\b'],
  ]) {
    assert.equal(
      startDocumentSchema.safeParse({ fileName: 'scan', pathnames }).success,
      false
    )
  }
  for (const fileName of ['', 'x'.repeat(256)])
    assert.equal(
      startDocumentSchema.safeParse({ fileName, pathnames: input.pathnames })
        .success,
      false
    )
})

test('encrypts with fresh IVs, round trips and rejects tampered or truncated artifacts and wrong keys', () => {
  const plaintext = Buffer.from('synthetic OCR')
  const encrypted = encryptArtifact(plaintext, key)
  assert.deepEqual(decryptArtifact(encrypted, key), plaintext)
  assert.notDeepEqual(encryptArtifact(plaintext, key), encrypted)
  assert.equal(encrypted.includes(plaintext), false)
  for (const index of [0, 12, 28]) {
    const tampered = Buffer.from(encrypted)
    tampered[index] = (tampered[index] ?? 0) ^ 1
    assert.throws(() => decryptArtifact(tampered, key))
  }
  assert.throws(() => decryptArtifact(encrypted.subarray(0, 27), key))
  assert.throws(() => decryptArtifact(encrypted, randomBytes(32)))
  assert.deepEqual(encryptionKey(key.toString('base64')), key)
  for (const value of [
    undefined,
    '',
    'secret',
    randomBytes(31).toString('base64'),
  ])
    assert.throws(() => encryptionKey(value), {
      message: 'Invalid document encryption key',
    })
})

test('renders ordered images, records dimensions, encrypts OCR and safely overwrites artifacts on retry', async () => {
  const h = harness()
  const png = await sharp({
    create: { width: 12, height: 8, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer()
  h.blobs.set(input.pathnames[0] ?? '', {
    bytes: png,
    contentType: 'image/png',
  })
  for (let attempt = 0; attempt < 2; attempt++) {
    const rendered = await renderDocument(input, h.deps)
    assert.deepEqual(rendered, { pageCount: 1 })
    await readDocument(documentId, rendered.pageCount, h.deps, async () => ({
      blocks: [],
      usage: { latencyMs: 1 },
    }))
  }
  assert.deepEqual(
    h.updates.map(([, update]) => update.status),
    [
      'rendering',
      'reading',
      'reading',
      'redacting',
      'rendering',
      'reading',
      'reading',
      'redacting',
    ]
  )
  assert.deepEqual(h.updates[1]?.[1].pageDimensions, [{ width: 12, height: 8 }])
  const thumbnail = h.blobs.get(`documents/${documentId}/render/1-thumb.webp`)
  assert.ok(thumbnail)
  assert.equal((await sharp(thumbnail.bytes).metadata()).format, 'webp')
  const artifact = h.blobs.get(`documents/${documentId}/ocr.json.enc`)
  assert.ok(artifact)
  assert.deepEqual(
    JSON.parse(decryptArtifact(artifact.bytes, key).toString()),
    [{ blocks: [], usage: { latencyMs: 1 } }]
  )
  assert.ok(h.writes.every((path) => !path.includes('/pages/')))
  for (const status of ['reviewed', 'discarded'] as const)
    await completeDocument(documentId, status, h.deps.update)
  assert.deepEqual(
    h.updates.slice(-2).map(([, update]) => update.status),
    ['reviewed', 'discarded']
  )
})

test('marks missing originals, unsupported input, missing render and OCR failures as failed without exposing causes', async () => {
  const h = harness()
  await assert.rejects(renderDocument(input, h.deps), {
    message: 'Document rendering failed',
  })
  assert.equal(h.updates.at(-1)?.[1].status, 'failed')
  h.blobs.set(input.pathnames[0] ?? '', {
    bytes: Buffer.from('invalid'),
    contentType: 'text/plain',
  })
  await assert.rejects(renderDocument(input, h.deps), {
    message: 'Document rendering failed',
  })
  await assert.rejects(readDocument(documentId, 1, h.deps), {
    message: 'Document reading failed',
  })
  h.blobs.set(`documents/${documentId}/render/1.png`, {
    bytes: Buffer.from('test'),
    contentType: 'image/png',
  })
  await assert.rejects(
    readDocument(documentId, 1, h.deps, async () => {
      throw new Error('sensitive provider body')
    }),
    { message: 'Document reading failed' }
  )
  assert.equal(h.updates.at(-1)?.[1].status, 'failed')
  assert.equal(h.writes.length, 0)
})

test('renders PDFs through the PDF stage and rejects mixed PDF and image uploads', async () => {
  const h = harness()
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.addPage([72, 144])
  h.blobs.set('uploads/document.pdf', {
    bytes: Buffer.from(await pdf.save()),
    contentType: 'application/pdf',
  })
  await renderDocument(
    {
      documentId,
      fileName: 'document.pdf',
      pathnames: ['uploads/document.pdf'],
    },
    h.deps
  )
  assert.deepEqual(h.updates.at(-1)?.[1], {
    status: 'reading',
    pageDimensions: [{ width: 144, height: 288 }],
  })
  await assert.rejects(
    renderDocument(
      {
        documentId,
        fileName: 'mixed',
        pathnames: ['uploads/document.pdf', ...input.pathnames],
      },
      h.deps
    ),
    { message: 'Document rendering failed' }
  )
  assert.equal(h.updates.at(-1)?.[1].status, 'failed')
})

test('preserves image order and marks failed when artifact storage or encryption configuration fails', async () => {
  const h = harness()
  for (const [index, width] of [10, 20].entries()) {
    h.blobs.set(`uploads/${index}.png`, {
      bytes: await sharp({
        create: { width, height: 8, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer(),
      contentType: 'image/png',
    })
  }
  await renderDocument(
    {
      documentId,
      fileName: 'ordered',
      pathnames: ['uploads/0.png', 'uploads/1.png'],
    },
    h.deps
  )
  assert.deepEqual(h.updates.at(-1)?.[1].pageDimensions, [
    { width: 10, height: 8 },
    { width: 20, height: 8 },
  ])
  await assert.rejects(
    readDocument(documentId, 2, {
      ...h.deps,
      key: () => {
        throw new Error('invalid key')
      },
    }),
    { message: 'Document reading failed' }
  )
  assert.equal(h.updates.at(-1)?.[1].status, 'failed')
  await assert.rejects(
    readDocument(
      documentId,
      2,
      {
        ...h.deps,
        storage: {
          ...h.deps.storage,
          put: async () => {
            throw new Error('sensitive storage response')
          },
        },
      },
      async () => ({ blocks: [], usage: { latencyMs: 1 } })
    ),
    { message: 'Document reading failed' }
  )
  assert.equal(h.updates.at(-1)?.[1].status, 'failed')
  assert.equal(h.blobs.has(`documents/${documentId}/ocr.json.enc`), false)
})
