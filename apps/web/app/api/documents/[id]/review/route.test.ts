import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PipelineError, pipeline } from '#lib/server/pipeline-client'
import { recordCache } from '#lib/server/record-cache'
import { POST } from './route.ts'

const ID = '981c8ddb-6a4c-5e2a-b667-cf98e800e72c'
const context = { params: Promise.resolve({ id: ID }) }

function request(body: unknown) {
  return new Request(`http://localhost/api/documents/${ID}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

test('expires terminal artifacts and patient profiles after accepted review actions', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  t.mock.method(pipeline, 'review', async () => ({ accepted: true as const }))
  assert.equal(
    (await POST(request({ type: 'markReviewed' }), context)).status,
    202
  )
  assert.deepEqual(invalidation.mock.calls[0]?.arguments, [ID])
})

test('keeps caches intact for invalid review actions and service failures', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  const review = t.mock.method(pipeline, 'review', async () => {
    throw new PipelineError(409)
  })
  assert.equal((await POST(request({ type: 'invalid' }), context)).status, 400)
  assert.equal(review.mock.callCount(), 0)
  assert.equal((await POST(request({ type: 'discard' }), context)).status, 409)
  assert.equal(invalidation.mock.callCount(), 0)
})

test('forwards observation, patient link and patient creation decisions unchanged', async (t) => {
  t.mock.method(recordCache, 'invalidate', () => {})
  const review = t.mock.method(pipeline, 'review', async () => ({
    accepted: true as const,
  }))
  const actions = [
    {
      type: 'observation.update',
      observationId: '0b0c3d2e-8f5a-5b1c-9d2e-3f4a5b6c7d8e',
      status: 'rejected',
    },
    { type: 'patient.link', patientId: 'PT-2210' },
    { type: 'patient.create' },
  ]
  for (const action of actions)
    assert.equal((await POST(request(action), context)).status, 202)
  assert.deepEqual(
    review.mock.calls.map((call) => call.arguments),
    actions.map((action) => [ID, action])
  )
})

test('rejects patient creation carrying document content', async (t) => {
  const review = t.mock.method(pipeline, 'review', async () => ({
    accepted: true as const,
  }))
  assert.equal(
    (await POST(request({ type: 'patient.create', name: 'Jane' }), context))
      .status,
    400
  )
  assert.equal(review.mock.callCount(), 0)
})

test('returns the service refusal with its safe error message without invalidating caches', async (t) => {
  const invalidation = t.mock.method(recordCache, 'invalidate', () => {})
  t.mock.method(pipeline, 'review', async () => {
    throw new PipelineError(409, 'reviewIncomplete')
  })

  const response = await POST(request({ type: 'markReviewed' }), context)

  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: 'Review action refused',
    refusal: 'reviewIncomplete',
  })
  assert.equal(invalidation.mock.callCount(), 0)
})
