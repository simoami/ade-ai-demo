import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PipelineError, pipeline, pipelineFailure } from './pipeline-client.ts'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

function configure() {
  process.env.PIPELINE_SERVICE_ORIGIN = 'http://127.0.0.1:8000'
  process.env.PIPELINE_SERVICE_SECRET = 'x'.repeat(32)
  delete process.env.VERCEL
}

test('sends authenticated start, status and review calls to the fixed service', async (t) => {
  configure()
  const requests: { url: string; options?: RequestInit }[] = []
  const responses = [
    { documentId, runId: 'run_1' },
    { documentId, runId: 'run_1', status: 'running' },
    { accepted: true },
  ]
  t.mock.method(
    globalThis,
    'fetch',
    async (url: URL, options?: RequestInit) => {
      requests.push({ url: url.href, options })
      return Response.json(responses.shift())
    }
  )

  await pipeline.start({ fixtureId: 'clinical-20' })
  await pipeline.status(documentId)
  await pipeline.review(documentId, { type: 'markReviewed' })

  assert.deepEqual(
    requests.map(({ url }) => url),
    [
      'http://127.0.0.1:8000/pipeline/documents',
      `http://127.0.0.1:8000/pipeline/documents/${documentId}`,
      `http://127.0.0.1:8000/pipeline/documents/${documentId}/review`,
    ]
  )
  assert.deepEqual(
    requests.map(({ options }) => options?.method),
    ['POST', 'GET', 'POST']
  )
  for (const { options } of requests) {
    assert.match(
      new Headers(options?.headers).get('authorization') ?? '',
      /^Basic /
    )
    assert.equal(options?.redirect, 'error')
    assert.equal(options?.cache, 'no-store')
    assert.ok(options?.signal instanceof AbortSignal)
  }
})

test('maps upstream failures and malformed responses without leaking their contents', async (t) => {
  configure()
  for (const status of [400, 404, 409, 401, 500]) {
    const mock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('private upstream content', { status })
    )
    await assert.rejects(
      pipeline.status(documentId),
      (error: unknown) =>
        error instanceof PipelineError &&
        error.status === ([400, 404, 409].includes(status) ? status : 503) &&
        !error.message.includes('private')
    )
    mock.mock.restore()
  }
  const mock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ private: 'content' })
  )
  await assert.rejects(pipeline.status(documentId), /Service unavailable/)
  mock.mock.restore()
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('private network failure')
  })
  await assert.rejects(pipeline.status(documentId), /Service unavailable/)
  const response = pipelineFailure(new Error('private failure'))
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Service unavailable' })
})
