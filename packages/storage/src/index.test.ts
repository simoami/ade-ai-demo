import assert from 'node:assert/strict'
import { test } from 'node:test'
import { del, get, head, list, put } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import { createStorage } from './index.ts'

const metadata = {
  url: 'https://example.private.blob.vercel-storage.com/item',
  downloadUrl: 'https://example.private.blob.vercel-storage.com/item',
  pathname: 'item',
  contentType: 'image/png',
  contentDisposition: 'inline',
  etag: 'etag',
}

test('forces private writes and returns streaming reads without caching', async (t) => {
  const client = { put, get, head, list, del, handleUpload }
  const write = t.mock.method(client, 'put', async () => metadata)
  const stream = new ReadableStream<Uint8Array>()
  const read = t.mock.method(client, 'get', async () => ({
    statusCode: 200 as const,
    stream,
    headers: new Headers(),
    blob: { ...metadata, cacheControl: '', uploadedAt: new Date(), size: 1 },
  }))
  const storage = createStorage(client)
  await storage.put('item', Buffer.from([1]), { contentType: 'image/png' })
  assert.deepEqual(write.mock.calls[0]?.arguments[2], {
    contentType: 'image/png',
    access: 'private',
  })
  assert.deepEqual(await storage.get('item'), {
    stream,
    contentType: 'image/png',
  })
  assert.deepEqual(read.mock.calls[0]?.arguments, [
    'item',
    { access: 'private', useCache: false },
  ])
})

test('preserves missing reads and propagates provider errors', async (t) => {
  const client = { put, get, head, list, del, handleUpload }
  t.mock.method(client, 'get', async () => null)
  const storage = createStorage(client)
  assert.equal(await storage.get('missing'), null)
  const error = new Error('provider unavailable')
  t.mock.method(client, 'put', async () => {
    throw error
  })
  await assert.rejects(
    storage.put('item', 'data', { contentType: 'text/plain' }),
    error
  )
})

test('delegates metadata, paginated prefix listing, deletion and upload tokens', async (t) => {
  const client = { put, get, head, list, del, handleUpload }
  const header = t.mock.method(client, 'head', async () => ({
    ...metadata,
    size: 1,
    uploadedAt: new Date(),
    cacheControl: '',
  }))
  const listing = t.mock.method(client, 'list', async () => ({
    blobs: [],
    hasMore: false,
  }))
  const deletion = t.mock.method(client, 'del', async () => {})
  const upload = t.mock.method(client, 'handleUpload', async () => ({
    type: 'blob.upload-completed' as const,
    response: 'ok' as const,
  }))
  const storage = createStorage(client)
  await storage.head('item')
  assert.deepEqual(header.mock.calls[0]?.arguments, ['item'])
  assert.deepEqual(await storage.list('prefix/', 'cursor'), {
    blobs: [],
    hasMore: false,
  })
  assert.deepEqual(listing.mock.calls[0]?.arguments, [
    { prefix: 'prefix/', cursor: 'cursor' },
  ])
  await storage.delete(['item'])
  assert.deepEqual(deletion.mock.calls[0]?.arguments, [['item']])
  const options = {
    request: new Request('https://example.com'),
    body: {
      type: 'blob.generate-client-token' as const,
      payload: { pathname: 'item', clientPayload: null, multipart: false },
    },
    onBeforeGenerateToken: async () => ({}),
  }
  await storage.handleUpload(options)
  assert.equal(upload.mock.calls[0]?.arguments[0], options)
})
