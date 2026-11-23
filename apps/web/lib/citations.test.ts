import assert from 'node:assert/strict'
import { test } from 'node:test'
import { citationNumbers, parseCitation } from './citations.ts'

test('parses document page citations', () => {
  assert.deepEqual(parseCitation('/documents/doc-1?page=3'), {
    documentId: 'doc-1',
    page: 3,
  })
})

test('rejects links that are not document page citations', () => {
  for (const href of [
    undefined,
    'https://example.com/documents/doc-1?page=3',
    '/documents/doc-1',
    '/documents/doc-1?page=0',
    '/documents/doc-1?tab=observations',
    '/patients/p-1?page=2',
  ])
    assert.equal(parseCitation(href), null)
})

test('numbers pages by first appearance and reuses repeated pages', () => {
  const numbers = citationNumbers(
    'A [page 3](/documents/a?page=3), B [page 1](/documents/b?page=1), ' +
      'again [page 3](/documents/a?page=3), [docs](https://example.com).'
  )

  assert.deepEqual(
    [...numbers],
    [
      ['/documents/a?page=3', 1],
      ['/documents/b?page=1', 2],
    ]
  )
})
