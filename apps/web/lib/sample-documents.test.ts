import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { test } from 'node:test'
import { sampleDocuments } from './sample-documents.ts'

test('offers four small synthetic scanned PDFs with readable download names and page counts', async () => {
  assert.deepEqual(
    sampleDocuments.map(({ id }) => id),
    ['clinical-01', 'intake-01', 'radiology-01', 'consent-01']
  )
  let total = 0
  for (const sample of sampleDocuments) {
    const file = new URL(
      `../public/sample-documents/${sample.id}.pdf`,
      import.meta.url
    )
    const fixture = new URL(
      `../../../fixtures/synthetic/${sample.id}/scanned.pdf`,
      import.meta.url
    )
    assert.deepEqual(await readFile(file), await readFile(fixture))
    const bytes = await readFile(file)
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
    assert.equal(sample.pages, sample.id === 'clinical-01' ? 2 : 1)
    assert.ok(sample.name.length > 0 && sample.description.length > 0)
    assert.match(sample.downloadName, /^sample-[a-z-]+\.pdf$/)
    total += (await stat(file)).size
  }
  assert.ok(total < 1024 * 1024)
})
