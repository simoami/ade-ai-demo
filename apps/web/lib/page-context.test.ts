import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pageContext, pageScopeLabel } from './page-context.ts'

test('scopes record pages to their ID and list pages to the whole workspace', () => {
  assert.deepEqual(pageContext('/patients/p-1', 'p-1'), {
    page: 'patient',
    patientId: 'p-1',
  })
  assert.deepEqual(pageContext('/documents/d-1', 'd-1'), {
    page: 'document',
    documentId: 'd-1',
  })
  assert.deepEqual(pageContext('/patients'), { page: 'patients' })
  assert.deepEqual(pageContext('/'), { page: 'documents' })
})

test('falls back to the list scope when a record route has no ID', () => {
  assert.deepEqual(pageContext('/patients/'), { page: 'patients' })
  assert.deepEqual(pageContext('/documents/'), { page: 'documents' })
})

test('labels document scopes by file name, falling back to the ID', () => {
  const documents = [{ id: 'd-1', fileName: 'labs.pdf' }]
  assert.equal(
    pageScopeLabel({ page: 'document', documentId: 'd-1' }, documents),
    'Document · labs.pdf'
  )
  assert.equal(
    pageScopeLabel({ page: 'document', documentId: 'd-2' }, documents),
    'Document · d-2'
  )
  assert.equal(
    pageScopeLabel({ page: 'patient', patientId: 'p-1' }, documents),
    'Patient · p-1'
  )
  assert.equal(pageScopeLabel({ page: 'patients' }, []), 'All patients')
})
