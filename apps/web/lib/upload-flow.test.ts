import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uploadDocument } from './upload-flow.ts'

const id = 'f38ac619-f99c-4b98-b4f6-0dc2f892c30c'

const files = [
  new File(['page'], 'a.png', { type: 'image/png' }),
  new File(['page'], 'b.jpg', { type: 'image/jpeg' }),
]

test('uploads pages in order and starts one document with returned pathnames', async () => {
  const names: string[] = []
  const progress: number[] = []
  const result = await uploadDocument(
    files,
    async (file, report) => {
      names.push(file.name)
      report(50)
      report(100)
      return `uploads/${file.name}-random`
    },
    (value) => progress.push(value),
    async (url, init) => {
      assert.equal(url, '/api/documents')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        fileName: 'a.png',
        pathnames: ['uploads/a.png-random', 'uploads/b.jpg-random'],
      })
      return Response.json({ documentId: id, runId: 'run' })
    }
  )
  assert.equal(result, id)
  assert.deepEqual(names, ['a.png', 'b.jpg'])
  assert.deepEqual(progress, [25, 50, 75, 100])
})

test('rejects invalid selections before upload or document creation', async () => {
  await assert.rejects(
    uploadDocument(
      [],
      async () => {
        throw new Error('must not upload')
      },
      () => {}
    ),
    /Choose a file/
  )
})

test('does not start a document when a blob upload fails', async () => {
  let started = false
  await assert.rejects(
    uploadDocument(
      files,
      async () => {
        throw new Error('upload failed')
      },
      () => {},
      async () => {
        started = true
        return Response.json({})
      }
    )
  )
  assert.equal(started, false)
})

test('rejects failed or malformed start responses', async () => {
  for (const response of [
    new Response('private error', { status: 503 }),
    Response.json({ documentId: 'bad' }),
  ]) {
    await assert.rejects(
      uploadDocument(
        files,
        async () => 'uploads/a',
        () => {},
        async () => response
      )
    )
  }
})
