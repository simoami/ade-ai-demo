import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authenticatePipeline } from '../agent/lib/pipeline-auth.ts'

const env = { OPENAI_API_KEY: 'test', PIPELINE_SERVICE_SECRET: 'x'.repeat(32) }

test('rejects missing and incorrect credentials before document handling', async () => {
  for (const authorization of [
    '',
    `Basic ${Buffer.from('pipeline:wrong').toString('base64')}`,
  ]) {
    const result = await authenticatePipeline(
      new Request('http://localhost/pipeline/documents', {
        headers: { authorization },
      }),
      env
    )
    assert.ok(result instanceof Response)
    assert.equal(result.status, 401)
  }
})

test('accepts the configured local service credential', async () => {
  const authorization = `Basic ${Buffer.from(`pipeline:${env.PIPELINE_SERVICE_SECRET}`).toString('base64')}`
  const result = await authenticatePipeline(
    new Request('http://localhost/pipeline/documents', {
      headers: { authorization },
    }),
    env
  )
  assert.ok(!(result instanceof Response))
})
