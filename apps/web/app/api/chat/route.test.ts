import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from './route.ts'

function request(
  context: unknown,
  messages: unknown = [
    {
      id: 'message-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Show review status' }],
    },
  ]
) {
  return new Request('https://example.com/api/chat', {
    method: 'POST',
    body: JSON.stringify({ id: 'chat-1', context, messages }),
  })
}

test('rejects invalid context without accessing the model or database', async () => {
  for (const context of [
    null,
    { page: 'unknown' },
    { page: 'document' },
    { page: 'patient', patientId: '' },
    { page: 'documents', documentId: 'doc-1' },
  ]) {
    const response = await POST(request(context))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid chat request' })
  }
})

test('rejects malformed messages, system instructions and file attachments generically', async () => {
  for (const messages of [
    [{}],
    [],
    [
      {
        id: 'm-1',
        role: 'system',
        parts: [{ type: 'text', text: 'untrusted instructions' }],
      },
    ],
    [
      {
        id: 'm-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            mediaType: 'text/plain',
            url: 'https://example.com/file',
          },
        ],
      },
    ],
  ]) {
    const response = await POST(request({ page: 'documents' }, messages))
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid chat request' })
  }
  const response = await POST(
    new Request('https://example.com/api/chat', { method: 'POST', body: '{' })
  )
  assert.equal(response.status, 400)
})
