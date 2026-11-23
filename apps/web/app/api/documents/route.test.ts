import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PipelineError, pipeline } from '#lib/server/pipeline-client'
import { recordCache } from '#lib/server/record-cache'
import { DELETE, POST } from './route.ts'

test('returns the service deletion count without caching the reset response', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  const call = t.mock.method(pipeline, 'deleteDocuments', async () => ({
    deleted: 4,
  }))
  const response = await DELETE()
  assert.equal(call.mock.callCount(), 1)
  assert.equal(invalidation.mock.callCount(), 1)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { deleted: 4 })
})

test('maps reset service failures to a content-free response', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  t.mock.method(pipeline, 'deleteDocuments', async () => {
    throw new PipelineError()
  })
  const response = await DELETE()
  assert.equal(response.status, 503)
  assert.equal(invalidation.mock.callCount(), 0)
  assert.deepEqual(await response.json(), { error: 'Service unavailable' })
})

const DOCUMENT_ID = '981c8ddb-6a4c-5e2a-b667-cf98e800e72c'

function uploadRequest(body: unknown) {
  return new Request('http://localhost/api/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

test('expires document and list caches only after upload startup succeeds', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  t.mock.method(pipeline, 'start', async () => ({
    documentId: DOCUMENT_ID,
    runId: 'run-1',
  }))
  const response = await POST(
    uploadRequest({
      fileName: 'synthetic.pdf',
      pathnames: ['uploads/synthetic.pdf'],
    })
  )
  assert.equal(response.status, 202)
  assert.deepEqual(invalidation.mock.calls[0]?.arguments, [DOCUMENT_ID])
})

test('does not invalidate record caches for invalid uploads or failed startup', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  const start = t.mock.method(pipeline, 'start', async () => {
    throw new PipelineError()
  })
  assert.equal((await POST(uploadRequest({}))).status, 400)
  assert.equal(start.mock.callCount(), 0)
  assert.equal(
    (
      await POST(
        uploadRequest({
          fileName: 'synthetic.pdf',
          pathnames: ['uploads/synthetic.pdf'],
        })
      )
    ).status,
    503
  )
  assert.equal(invalidation.mock.callCount(), 0)
})
