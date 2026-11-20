import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { publishRedactedPages } from '#workflows/ingest-document/publish-redacted-pages'

async function harness(version: number | null = null) {
  const bytes = await sharp({
    create: { width: 800, height: 400, channels: 3, background: 'black' },
  })
    .png()
    .toBuffer()
  const events: string[] = []
  const writes: Buffer[] = []
  const deps = {
    find: async () => ({
      pageVersion: version,
      pageDimensions: [{ width: 800, height: 400 }],
    }),
    update: async (_id: string, values: { pageVersion?: number | null }) => {
      events.push(`publish:${values.pageVersion}`)
    },
    storage: {
      put: async (pathname: string, body: unknown) => {
        assert.ok(Buffer.isBuffer(body))
        writes.push(body)
        events.push(pathname)
        return {
          url: '',
          downloadUrl: '',
          pathname,
          contentType: 'image/webp',
          contentDisposition: '',
          etag: '',
        }
      },
      list: async (_prefix: string) => ({ blobs: [], hasMore: false }),
      delete: async () => {},
    },
  }
  return { bytes, events, writes, deps }
}

test('writes full and thumbnail pixels before publishing the incremented version and cleaning old files', async () => {
  for (const previous of [null, 1]) {
    const h = await harness(previous)
    const version = (previous ?? 0) + 1
    const removed: string[] = []
    const result = await publishRedactedPages('id', [h.bytes], {
      ...h.deps,
      storage: {
        ...h.deps.storage,
        list: async (prefix) => {
          h.events.push(`list:${prefix}`)
          return {
            hasMore: false,
            blobs: [
              {
                pathname: `${prefix}1.png`,
                url: '',
                downloadUrl: '',
                etag: 'test',
                size: 1,
                uploadedAt: new Date(),
              },
              ...(prefix.endsWith('pages/')
                ? [
                    {
                      pathname: `${prefix}1-v${version}.webp`,
                      url: '',
                      downloadUrl: '',
                      etag: 'test',
                      size: 1,
                      uploadedAt: new Date(),
                    },
                  ]
                : []),
            ],
          }
        },
        delete: async (paths) => {
          removed.push(...(typeof paths === 'string' ? [paths] : paths))
        },
      },
    })
    assert.equal(result, version)
    assert.deepEqual(h.events.slice(0, 3), [
      `documents/id/pages/1-v${version}.webp`,
      `documents/id/pages/1-v${version}-thumb.webp`,
      `publish:${version}`,
    ])
    assert.ok(removed.includes('documents/id/render/1.png'))
    assert.ok(!removed.includes(`documents/id/pages/1-v${version}.webp`))
    assert.equal((await sharp(h.writes[0]).metadata()).width, 800)
    assert.equal((await sharp(h.writes[1]).metadata()).width, 200)
    assert.equal((await sharp(h.writes[1]).metadata()).height, 100)
  }
})

test('rejects missing documents, incomplete page sets and write failures before publishing or deleting', async () => {
  const h = await harness()
  await assert.rejects(
    publishRedactedPages('id', [h.bytes], {
      ...h.deps,
      find: async () => undefined,
    }),
    /not found/
  )
  await assert.rejects(publishRedactedPages('id', [], h.deps), /count/)
  await assert.rejects(
    publishRedactedPages('id', [h.bytes], {
      ...h.deps,
      storage: {
        ...h.deps.storage,
        put: async () => {
          throw new Error('write failed')
        },
      },
    }),
    /write failed/
  )
  assert.deepEqual(h.events, [])
})

test('propagates cleanup failure after publishing so the caller can retry', async () => {
  const h = await harness()
  await assert.rejects(
    publishRedactedPages('id', [h.bytes], {
      ...h.deps,
      storage: {
        ...h.deps.storage,
        list: async () => {
          throw new Error('cleanup failed')
        },
      },
    }),
    /cleanup failed/
  )
  assert.equal(h.events.at(-1), 'publish:1')
})
