import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deleteDocuments } from '#agent/channels/documents-admin'

function harness() {
  const calls: string[] = []
  const dependencies = {
    authenticate: async () => ({ kind: 'basic' as const }),
    listDocuments: async () => [
      { runId: 'running' },
      { runId: 'finished' },
      { runId: null },
    ],
    cancelRun: async (runId: string) => {
      calls.push(`cancel:${runId}`)
    },
    storage: {
      list: async (prefix: string, cursor?: string) => {
        calls.push(`list:${prefix}:${cursor ?? ''}`)
        return {
          blobs: [
            {
              pathname: `${prefix}${cursor ? 'second' : 'first'}`,
              url: '',
              downloadUrl: '',
              size: 1,
              uploadedAt: new Date(),
              etag: '',
            },
          ],
          hasMore: !cursor,
          cursor: cursor ? undefined : 'next',
        }
      },
      delete: async (path: string | string[]) => {
        calls.push(`delete:${String(path)}`)
      },
    },
    deleteRows: async () => {
      calls.push('rows')
      return 3
    },
  }
  return { calls, dependencies }
}

const request = () =>
  new Request('http://localhost/pipeline/documents', { method: 'DELETE' })

test('rejects unauthenticated deletion before accessing documents or storage', async () => {
  const h = harness()
  const response = await deleteDocuments(request(), {
    ...h.dependencies,
    authenticate: async () => new Response(null, { status: 401 }),
  })
  assert.equal(response.status, 401)
  assert.deepEqual(h.calls, [])
})

test('cancels runs, paginates both artifact prefixes and returns the deleted document count', async () => {
  const h = harness()
  const response = await deleteDocuments(request(), h.dependencies)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { deleted: 3 })
  assert.deepEqual(h.calls, [
    'cancel:running',
    'cancel:finished',
    'list:documents/:',
    'delete:documents/first',
    'list:documents/:next',
    'delete:documents/second',
    'list:uploads/:',
    'delete:uploads/first',
    'list:uploads/:next',
    'delete:uploads/second',
    'rows',
  ])
})

test('continues cleanup if a workflow finished before cancellation', async () => {
  const h = harness()
  const response = await deleteDocuments(request(), {
    ...h.dependencies,
    cancelRun: async () => {
      throw new Error('Already finished')
    },
  })
  assert.deepEqual(await response.json(), { deleted: 3 })
  assert.equal(h.calls.at(-1), 'rows')
})

test('returns a content-free failure and retains rows when Blob deletion fails', async () => {
  const h = harness()
  const response = await deleteDocuments(request(), {
    ...h.dependencies,
    storage: {
      ...h.dependencies.storage,
      delete: async () => {
        throw new Error('private data')
      },
    },
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Service unavailable' })
  assert.equal(h.calls.includes('rows'), false)
})

test('returns a content-free failure when database deletion fails', async () => {
  const h = harness()
  const response = await deleteDocuments(request(), {
    ...h.dependencies,
    deleteRows: async () => {
      throw new Error('private data')
    },
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Service unavailable' })
})
