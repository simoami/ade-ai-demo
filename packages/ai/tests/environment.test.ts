import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateEnvironment } from '#agent/lib/environment'

test('accepts an OpenAI key', () => {
  assert.doesNotThrow(() =>
    validateEnvironment({
      OPENAI_API_KEY: 'test-key',
      PIPELINE_SERVICE_SECRET: 'x'.repeat(32),
    })
  )
})

test('rejects missing, blank and Gateway-only credentials without disclosing values', () => {
  for (const env of [
    {},
    { OPENAI_API_KEY: ' ' },
    { OPENAI_API_KEY: '' },
    { AI_GATEWAY_API_KEY: 'secret' },
    { VERCEL_OIDC_TOKEN: 'secret' },
  ]) {
    assert.throws(
      () => validateEnvironment(env),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('OPENAI_API_KEY') &&
        !error.message.includes('secret')
    )
  }
})

test('requires local service credentials and a project ID for deployed OIDC', () => {
  assert.throws(
    () => validateEnvironment({ OPENAI_API_KEY: 'test' }),
    /PIPELINE_SERVICE_SECRET/
  )
  assert.throws(
    () => validateEnvironment({ OPENAI_API_KEY: 'test', VERCEL: '1' }),
    /VERCEL_PROJECT_ID/
  )
  assert.doesNotThrow(() =>
    validateEnvironment({
      OPENAI_API_KEY: 'test',
      VERCEL: '1',
      VERCEL_PROJECT_ID: 'prj_test',
    })
  )
})
