import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  uploadDestination,
  uploadDocuments,
  uploadSummary,
} from '#lib/upload-flow'

const id = 'f38ac619-f99c-4b98-b4f6-0dc2f892c30c'

const files = [
  new File(['page'], 'a.png', { type: 'image/png' }),
  new File(['page'], 'b.jpg', { type: 'image/jpeg' }),
]

test('starts one document per file with one returned pathname and overall progress', async () => {
  const bodies: unknown[] = []
  const progress: number[] = []
  const results = await uploadDocuments(
    files,
    async (file, report) => {
      report(50)
      report(100)
      return `uploads/${file.name}`
    },
    (value) => progress.push(value),
    async (url, init) => {
      assert.equal(url, '/api/documents')
      assert.equal(init?.method, 'POST')
      bodies.push(JSON.parse(String(init?.body)))
      return Response.json({ documentId: id, runId: 'run' })
    }
  )
  assert.deepEqual(
    bodies,
    files.map((file) => ({
      fileName: file.name,
      pathnames: [`uploads/${file.name}`],
    }))
  )
  assert.equal(results.filter((result) => !result.failed).length, 2)
  assert.equal(progress[0], 25)
  assert.equal(progress.at(-1), 100)
  assert.ok(
    progress.every((value, index) => value >= (progress[index - 1] ?? 0))
  )
  assert.equal(uploadSummary(results), '2 documents uploading')
})

test('rejects invalid selections before invoking upload', async () => {
  await assert.rejects(
    uploadDocuments(
      [],
      async () => assert.fail('must not upload'),
      () => {}
    ),
    /Choose a file/
  )
})

test('continues after a failed upload and reports only the failed filename', async () => {
  let starts = 0
  const results = await uploadDocuments(
    files,
    async (file) => {
      if (file.name === 'a.png') throw new Error('private service details')
      return 'uploads/b.jpg'
    },
    () => {},
    async () => {
      starts++
      return Response.json({ documentId: id, runId: 'run' })
    }
  )
  assert.equal(starts, 1)
  assert.equal(
    uploadSummary(results),
    'Uploaded 1 of 2; 1 failed: a.png. Please try again.'
  )
  assert.equal(uploadDestination(results), null)
})

test('reports failed and malformed document starts as file failures', async () => {
  for (const response of [
    new Response('private error', { status: 503 }),
    Response.json({ documentId: 'bad' }),
  ]) {
    const results = await uploadDocuments(
      files.slice(0, 1),
      async () => 'uploads/a',
      () => {},
      async () => response
    )
    assert.equal(
      uploadSummary(results),
      'Uploaded 0 of 1; 1 failed: a.png. Please try again.'
    )
    assert.equal(uploadDestination(results), null)
  }
})

test('navigates only for one successful file', () => {
  const success = { fileName: 'a.png', documentId: id, failed: false as const }
  assert.equal(uploadDestination([success]), `/documents/${id}`)
  assert.equal(uploadDestination([success, success]), null)
  assert.equal(uploadDestination([{ fileName: 'a.png', failed: true }]), null)
  assert.equal(uploadDestination([]), null)
})

test('starts one document per file and reports overall progress', async () => {
  let starts = 0
  const progress: number[] = []
  const results = await uploadDocuments(
    Array(10).fill(files[0]),
    async (_, report) => {
      report(100)
      return 'uploads/a'
    },
    (percentage) => progress.push(percentage),
    async () => {
      starts++
      return Response.json({ documentId: id, runId: 'run' })
    }
  )
  assert.equal(starts, 10)
  assert.equal(results.length, 10)
  assert.equal(progress.at(-1), 100)
})
