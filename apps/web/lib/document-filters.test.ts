import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterDocuments } from './document-filters.ts'
import type { DocumentSummary } from './sample-records.ts'

const documents: DocumentSummary[] = [
  {
    id: 'clinical',
    fileName: 'Clinical.pdf',
    documentClass: 'clinical',
    patientId: 'PT-1',
    pages: 2,
    status: 'needsReview',
    uploadedAt: '2026-11-19',
  },
  {
    id: 'consent',
    fileName: 'Consent.pdf',
    documentClass: 'consent',
    patientId: null,
    pages: 1,
    status: 'reviewed',
    uploadedAt: '2026-11-18',
  },
]

test('combines category and status filters with case-insensitive patient or file search', () => {
  assert.equal(filterDocuments(documents, 'All', '').length, 2)
  assert.deepEqual(filterDocuments(documents, 'Needs review', ' pt-1 '), [
    documents[0],
  ])
  assert.deepEqual(filterDocuments(documents, 'Clinical', 'CLINICAL'), [
    documents[0],
  ])
  assert.deepEqual(filterDocuments(documents, 'Consent', ''), [documents[1]])
})

test('returns no rows for unmatched searches and conflicting filters', () => {
  assert.deepEqual(filterDocuments(documents, 'All', 'missing'), [])
  assert.deepEqual(filterDocuments(documents, 'Consent', 'pt-1'), [])
})
