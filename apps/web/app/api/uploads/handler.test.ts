import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createUploadHandler } from './handler.ts'

function request(pathname: string) {
  return new Request('https://example.com/api/uploads', {
    method: 'POST',
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, clientPayload: null, multipart: false },
    }),
  })
}

test('constrains signed tokens to supported content types, size and random suffixes', async () => {
  const handler = createUploadHandler(async (options) => {
    const rules = await options.onBeforeGenerateToken(
      'uploads/original.pdf',
      null,
      false
    )
    assert.deepEqual(rules.allowedContentTypes, [
      'application/pdf',
      'image/png',
      'image/jpeg',
    ])
    assert.equal(rules.allowedContentTypes?.includes('text/html'), false)
    assert.equal(rules.maximumSizeInBytes, 20 * 1024 * 1024)
    assert.equal(rules.addRandomSuffix, true)
    assert.equal(rules.allowOverwrite, false)
    return { type: 'blob.generate-client-token', clientToken: 'test-token' }
  })
  assert.equal((await handler(request('uploads/original.pdf'))).status, 200)
})

test('rejects traversal, encoded separators and unsupported prefixes before token issuance', async () => {
  const handler = createUploadHandler(async (options) => {
    assert.equal(options.body.type, 'blob.generate-client-token')
    if (options.body.type !== 'blob.generate-client-token') {
      throw new Error('Unexpected event')
    }
    await options.onBeforeGenerateToken(
      options.body.payload.pathname,
      null,
      false
    )
    assert.fail('Invalid pathname must not receive a token')
  })
  for (const pathname of [
    'documents/a.pdf',
    'uploads/../a.pdf',
    'uploads/a/./b',
    'uploads/a%2fb',
    'uploads/a\\b',
    'uploads//a',
    'uploads/',
  ]) {
    assert.equal((await handler(request(pathname))).status, 503)
  }
})

test('rejects invalid JSON before invoking the Blob SDK', async () => {
  const handler = createUploadHandler(async () => {
    assert.fail('Invalid JSON must not reach the Blob SDK')
  })
  assert.equal(
    (
      await handler(
        new Request('https://example.com', { method: 'POST', body: '{' })
      )
    ).status,
    400
  )
})

test('returns fixed errors for rejected content types, oversized uploads and invalid callbacks', async () => {
  for (const reason of [
    'content type not allowed: secret',
    'file too large: secret',
    'invalid signature: secret',
  ]) {
    const handler = createUploadHandler(async () => {
      throw new Error(reason)
    })
    const response = await handler(request('uploads/original.pdf'))
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'Upload unavailable' })
  }
})

test('passes protocol fields through to the Blob SDK unchanged', async () => {
  const body = {
    type: 'blob.upload-completed',
    payload: { sdkExtension: 'preserved' },
    sdkExtension: true,
  }
  const handler = createUploadHandler(async (options) => {
    assert.deepEqual(options.body, body)
    return { type: 'blob.upload-completed', response: 'ok' }
  })
  const response = await handler(
    new Request('https://example.com/api/uploads', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  )
  assert.equal(response.status, 200)
})

test('accepts filenames with spaces and unicode using the shared pathname contract', async () => {
  const handler = createUploadHandler(async (options) => {
    if (options.body.type !== 'blob.generate-client-token')
      throw new Error('Unexpected event')

    await options.onBeforeGenerateToken(
      options.body.payload.pathname,
      null,
      false
    )
    return { type: 'blob.generate-client-token', clientToken: 'test-token' }
  })
  assert.equal(
    (await handler(request('uploads/clinical résumé 2026.pdf'))).status,
    200
  )
})
