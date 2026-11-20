import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateEnvironment } from './environment.ts'

const secret = 'x'.repeat(32)

test('accepts fixed loopback and HTTPS service origins', () => {
  for (const origin of ['http://127.0.0.1:8000', 'https://agent.example.com']) {
    assert.equal(
      validateEnvironment({
        PIPELINE_SERVICE_ORIGIN: origin,
        PIPELINE_SERVICE_SECRET: secret,
      }).PIPELINE_SERVICE_ORIGIN,
      origin
    )
  }
})

test('rejects missing credentials and unsafe origins without exposing values', () => {
  for (const origin of [
    'https://secret@example.com',
    'http://example.com',
    'https://example.com/path',
    'https://example.com?secret',
  ]) {
    assert.throws(
      () =>
        validateEnvironment({
          PIPELINE_SERVICE_ORIGIN: origin,
          PIPELINE_SERVICE_SECRET: secret,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('PIPELINE_SERVICE_ORIGIN') &&
        !error.message.includes(origin)
    )
  }
  assert.throws(
    () =>
      validateEnvironment({ PIPELINE_SERVICE_ORIGIN: 'http://localhost:8000' }),
    /PIPELINE_SERVICE_SECRET/
  )
  assert.doesNotThrow(() =>
    validateEnvironment({
      PIPELINE_SERVICE_ORIGIN: 'https://agent.example.com',
      VERCEL: '1',
    })
  )
})

test('defaults the service origin to the deployment URL on Vercel only', () => {
  assert.equal(
    validateEnvironment({ VERCEL: '1', VERCEL_URL: 'app-abc.vercel.app' })
      .PIPELINE_SERVICE_ORIGIN,
    'https://app-abc.vercel.app'
  )
  assert.throws(
    () =>
      validateEnvironment({
        VERCEL_URL: 'app-abc.vercel.app',
        PIPELINE_SERVICE_SECRET: secret,
      }),
    /PIPELINE_SERVICE_ORIGIN/
  )
})
