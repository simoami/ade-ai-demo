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

test('rejects originals, renders, OCR and malformed paths before accessing storage', async () => {
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
    ['documents', id, 'render', '1.png'],
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
