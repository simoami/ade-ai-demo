import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test } from 'node:test'
import { authenticatePipeline } from '#agent/lib/pipeline-auth'

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

const vercelEnv = {
  OPENAI_API_KEY: 'test',
  VERCEL: '1',
  VERCEL_PROJECT_ID: 'prj_pipeline',
  VERCEL_ENV: 'preview',
}

function request(authorization: string) {
  return new Request('https://service.example/pipeline/documents', {
    headers: { authorization },
  })
}

test('rejects missing, malformed, and Basic credentials on Vercel', async () => {
  for (const authorization of [
    '',
    'Bearer invalid',
    'Basic cGlwZWxpbmU6dGVzdA==',
  ]) {
    const result = await authenticatePipeline(request(authorization), vercelEnv)
    assert.ok(result instanceof Response)
    assert.equal(result.status, 401)
  }
})

test('verifies deployment JWT signatures and project claims against mocked JWKS', async (t) => {
  const issuer = 'https://oidc.vercel.com/pipeline-test'
  const jwksUrl = `${issuer}/jwks`
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  })
  const jwk = {
    ...publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  }
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    const href = url instanceof Request ? url.url : String(url)
    assert.ok(
      [`${issuer}/.well-known/openid-configuration`, jwksUrl].includes(href)
    )
    return Response.json(
      href === jwksUrl ? { keys: [jwk] } : { issuer, jwks_uri: jwksUrl }
    )
  })
  const now = Math.floor(Date.now() / 1000)

  function token(overrides: Record<string, unknown> = {}, corrupt = false) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', kid: 'test-key' })
    ).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({
        iss: issuer,
        aud: 'https://vercel.com/test-team',
        sub: 'owner:test-team:project:pipeline:environment:preview',
        project_id: vercelEnv.VERCEL_PROJECT_ID,
        environment: 'preview',
        iat: now,
        exp: now + 300,
        ...overrides,
      })
    ).toString('base64url')
    const body = `${header}.${payload}`
    const signature = sign('RSA-SHA256', Buffer.from(body), privateKey)
    if (corrupt) signature[0] = (signature[0] ?? 0) ^ 255
    return `${body}.${signature.toString('base64url')}`
  }

  const accepted = await authenticatePipeline(
    request(`Bearer ${token()}`),
    vercelEnv
  )
  assert.ok(!(accepted instanceof Response))
  assert.equal(accepted.principalType, 'runtime')

  for (const jwt of [
    token({ project_id: 'prj_other' }),
    token({ exp: now - 3600 }),
    token({ aud: 'https://attacker.example' }),
    token({ iss: 'https://attacker.example' }),
    token({}, true),
  ]) {
    const result = await authenticatePipeline(
      request(`Bearer ${jwt}`),
      vercelEnv
    )
    assert.ok(result instanceof Response)
    assert.equal(result.status, 401)
  }
})
