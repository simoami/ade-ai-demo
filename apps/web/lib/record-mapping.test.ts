import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentPageImages, patientFieldMatches } from './record-mapping.ts'
import type { DocumentStatus } from './records-types.ts'

test('compares each identifier independently and treats missing values on either side as absent', () => {
  assert.deepEqual(
    patientFieldMatches(
      { lastName: 'a', firstName: 'b', mrn: 'c', sex: 'Female' },
      { lastName: 'a', firstName: 'x', birthDate: 'd', sex: 'Male' }
    ),
    {
      lastName: 'match',
      firstName: 'mismatch',
      birthDate: 'absent',
      mrn: 'absent',
      sex: 'mismatch',
    }
  )
  assert.deepEqual(
    Object.values(patientFieldMatches(null, { mrn: 'a' })),
    Array(5).fill('absent')
  )
  assert.equal(
    patientFieldMatches({ sex: 'Female' }, { sex: 'Female' }).sex,
    'match'
  )
})

test('exposes one-based private page URLs only for statuses with redacted pages', () => {
  for (const status of [
    'extracting',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
  ] satisfies DocumentStatus[]) {
    assert.deepEqual(documentPageImages('id', status, 2), [
      '/api/files/documents/id/pages/1.webp',
      '/api/files/documents/id/pages/2.webp',
    ])
    assert.deepEqual(documentPageImages('id', status, 0), [])
  }
  for (const status of [
    'rendering',
    'reading',
    'redacting',
    'failed',
  ] satisfies DocumentStatus[]) {
    assert.deepEqual(documentPageImages('id', status, 2), [])
  }
})
