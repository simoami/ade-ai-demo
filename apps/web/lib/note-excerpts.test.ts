import assert from 'node:assert/strict'
import { test } from 'node:test'
import { noteExcerpts, pageKey } from './note-excerpts.ts'

const chunk = {
  documentId: 'synthetic-document',
  fileName: 'synthetic.pdf',
  page: 1,
  section: null,
  text: 'Synthetic assessment. '.repeat(20),
  box: { x: 0, y: 0, width: 1, height: 1 },
}

test('keeps the best-ranked chunk per page and bounds its excerpt', () => {
  const excerpts = noteExcerpts([
    chunk,
    { ...chunk, text: 'Lower ranked duplicate' },
    { ...chunk, page: 2 },
  ])

  assert.deepEqual(
    [...excerpts.keys()],
    ['synthetic-document:1', 'synthetic-document:2']
  )

  const first = excerpts.get(pageKey(chunk.documentId, 1))
  assert.equal(first?.text.length, 200)
  assert.ok(first?.text.endsWith('…'))
  assert.ok(first?.text.startsWith('Synthetic assessment.'))
})

test('collapses whitespace in short excerpts and keeps the section path', () => {
  const excerpts = noteExcerpts([
    { ...chunk, section: 'Visit › Chief complaint', text: ' Stable.\n' },
  ])

  assert.deepEqual(excerpts.get('synthetic-document:1'), {
    section: 'Visit › Chief complaint',
    text: 'Stable.',
  })
  assert.equal(noteExcerpts([]).size, 0)
})
