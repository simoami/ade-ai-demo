import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFileHandler } from './handler.ts'

const request = new Request(
  'https://example.com/api/files/documents/id/page.png'
)

function context(pathname: string[]) {
  return { params: Promise.resolve({ pathname }) }
}

test('streams allowed private files with content type and privacy headers', async () => {
  const handler = createFileHandler(async (pathname) => {
    assert.equal(pathname, 'documents/id/page.png')
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.close()
        },
      }),
      contentType: 'image/png',
    }
  })
  const response = await handler(
    request,
    context(['documents', 'id', 'page.png'])
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-cache')
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([1, 2])
  )
})

test('rejects traversal and non-document paths before accessing storage', async () => {
  const handler = createFileHandler(async () => {
    throw new Error('must not be called')
  })
  for (const pathname of [
    [],
    ['documents'],
    ['uploads', 'a.pdf'],
    ['documents', '..', 'a'],
    ['documents', '.'],
    ['documents', 'a/b'],
    ['documents', '%2e%2e'],
    ['documents', 'a\\b'],
    ['documents', ''],
  ]) {
    assert.equal((await handler(request, context(pathname))).status, 400)
  }
})

test('returns 404 for missing blobs and fixed errors for provider failures', async () => {
  const missing = createFileHandler(async () => null)
  assert.equal(
    (await missing(request, context(['documents', 'missing']))).status,
    404
  )
  const failed = createFileHandler(async () => {
    throw new Error('sensitive provider details')
  })
  const response = await failed(request, context(['documents', 'id']))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'File unavailable' })
})
