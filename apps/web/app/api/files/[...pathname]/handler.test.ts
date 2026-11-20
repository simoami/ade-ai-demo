import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFileHandler } from './handler.ts'

const id = 'f38ac619-f99c-4b98-b4f6-0dc2f892c30c'

const request = new Request(
  `https://example.com/api/files/documents/${id}/pages/1.webp`
)

const valid = ['documents', id, 'pages', '1.webp']

function context(pathname: string[]) {
  return { params: Promise.resolve({ pathname }) }
}

test('streams only redacted pages with privacy headers', async () => {
  const handler = createFileHandler(async (pathname) => {
    assert.equal(pathname, `documents/${id}/pages/1.webp`)
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.close()
        },
      }),
      contentType: 'image/webp',
    }
  })
  const response = await handler(request, context(valid))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([1, 2])
  )
})

test('rejects originals, OCR and malformed paths before accessing storage', async () => {
  let calls = 0
  const handler = createFileHandler(async () => {
    calls++
    return null
  })
  for (const pathname of [
    [],
    ['documents'],
    ['uploads', 'a.pdf'],
    ['documents', '..', 'pages', '1.webp'],
    ['documents', 'not-a-uuid', 'pages', '1.webp'],
    ['documents', id, 'render', '0.png'],
    ['documents', id, 'render', '01.png'],
    ['documents', id, 'render', '1.webp'],
    ['documents', id, 'render', '../1.png'],
    ['documents', id, 'render', '%2e%2e'],
    ['documents', id, 'render', '1.png', 'extra'],
    ['documents', id, 'ocr.json.enc'],
    ['documents', id, 'pages', '0.webp'],
    ['documents', id, 'pages', '01.webp'],
    ['documents', id, 'pages', '-1.webp'],
    ['documents', id, 'pages', '1.png'],
    ['documents', id, 'pages', '1.webp', 'extra'],
    ['documents', id, 'pages', '../1.webp'],
    ['documents', id, 'pages', '%2e%2e'],
  ]) {
    assert.equal((await handler(request, context(pathname))).status, 400)
  }
  assert.equal(calls, 0)
})

test('returns 404 for missing pages and safe errors for provider failures', async () => {
  const missing = createFileHandler(async () => null)
  assert.equal((await missing(request, context(valid))).status, 404)
  const failed = createFileHandler(async () => {
    throw new Error('sensitive provider details')
  })
  const response = await failed(request, context(valid))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'File unavailable' })
})

test('serves PNG renders only while reading or redacting', async () => {
  for (const status of ['reading', 'redacting'] as const) {
    const handler = createFileHandler(
      async (pathname) => {
        assert.equal(pathname, `documents/${id}/render/1.png`)
        return {
          stream: new ReadableStream({
            start(c) {
              c.close()
            },
          }),
          contentType: 'image/png',
        }
      },
      async (documentId) => {
        assert.equal(documentId, id)
        return status
      }
    )
    const response = await handler(
      request,
      context(['documents', id, 'render', '1.png'])
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  }
})

test('hides renders in every other status and for missing documents without reading storage', async () => {
  for (const status of [
    'rendering',
    'extracting',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
    'failed',
    undefined,
  ] as const) {
    const handler = createFileHandler(
      async () => {
        assert.fail('Storage must not be read')
      },
      async () => status
    )
    assert.equal(
      (await handler(request, context(['documents', id, 'render', '1.png'])))
        .status,
      404
    )
  }
})

test('returns 404 for missing renders and a safe error when the status lookup fails', async () => {
  const render = context(['documents', id, 'render', '1.png'])
  const missing = createFileHandler(
    async () => null,
    async () => 'reading'
  )
  assert.equal((await missing(request, render)).status, 404)

  const failed = createFileHandler(
    async () => {
      assert.fail('Storage must not be read')
    },
    async () => {
      throw new Error('private database details')
    }
  )
  const response = await failed(request, render)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'File unavailable' })
})
