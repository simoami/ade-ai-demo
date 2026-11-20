import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PipelineError, pipeline } from '#lib/server/pipeline-client'
import { DELETE } from './route.ts'

test('returns the service deletion count without caching the reset response', async (t) => {
  const call = t.mock.method(pipeline, 'deleteDocuments', async () => ({
    deleted: 4,
  }))
  const response = await DELETE()
  assert.equal(call.mock.callCount(), 1)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { deleted: 4 })
})

test('maps reset service failures to a content-free response', async (t) => {
  t.mock.method(pipeline, 'deleteDocuments', async () => {
    throw new PipelineError()
  })
  const response = await DELETE()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Service unavailable' })
})
