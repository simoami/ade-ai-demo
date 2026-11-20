import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { PipelineError, pipeline, pipelineFailure } from './pipeline-client.ts'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

function configure() {
  process.env.PIPELINE_SERVICE_ORIGIN = 'http://127.0.0.1:8000'
  process.env.PIPELINE_SERVICE_SECRET = 'x'.repeat(32)
  delete process.env.VERCEL
}

function mockEnvironment(
  t: TestContext,
  values: Record<string, string | undefined>
) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  )
  function apply(env: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  apply(values)
  t.after(() => apply(previous))
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

  await pipeline.start({
    fileName: 'sample.pdf',
    pathnames: ['uploads/sample-a1b2.pdf'],
  })
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

test('forwards deployment bearer credentials and preserves the binding path', async (t) => {
  configure()
  const token = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`
  mockEnvironment(t, {
    VERCEL: '1',
    VERCEL_OIDC_TOKEN: token,
    VERCEL_OIDC_TOKEN_FILE: undefined,
    PIPELINE_SERVICE_ORIGIN: 'https://service.example/internal',
  })
  t.mock.method(
    globalThis,
    'fetch',
    async (url: URL, options?: RequestInit) => {
      assert.equal(
        url.href,
        `https://service.example/internal/pipeline/documents/${documentId}`
      )
      assert.equal(
        new Headers(options?.headers).get('authorization'),
        `Bearer ${token}`
      )
      return Response.json({ documentId, runId: 'run_1', status: 'running' })
    }
  )

  await pipeline.status(documentId)
})

test('fails closed without a deployment binding before making a request', async (t) => {
  configure()
  mockEnvironment(t, {
    VERCEL: '1',
    VERCEL_URL: 'app-abc.vercel.app',
    PIPELINE_SERVICE_ORIGIN: undefined,
  })
  const request = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected request')
  })

  await assert.rejects(pipeline.status(documentId), /Service unavailable/)
  assert.equal(request.mock.callCount(), 0)
})

test('sends authenticated DELETE and rejects an invalid document count', async (t) => {
  configure()
  let valid = true
  t.mock.method(
    globalThis,
    'fetch',
    async (url: URL, options?: RequestInit) => {
      assert.equal(url.href, 'http://127.0.0.1:8000/pipeline/documents')
      assert.equal(options?.method, 'DELETE')
      assert.equal(options?.body, undefined)
      assert.match(
        new Headers(options?.headers).get('authorization') ?? '',
        /^Basic /
      )
      return Response.json({ deleted: valid ? 3 : -1 })
    }
  )
  assert.deepEqual(await pipeline.deleteDocuments(), { deleted: 3 })
  valid = false
  await assert.rejects(pipeline.deleteDocuments(), /Service unavailable/)
})
