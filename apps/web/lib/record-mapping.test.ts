import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  observationState,
  observationSummary,
  patientFieldMatches,
} from './record-mapping.ts'

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

test('shows unchecked extractions as extracted and only flagged observations as needing review', () => {
  assert.deepEqual(
    (
      ['unchecked', 'flagged', 'confirmed', 'corrected', 'rejected'] as const
    ).map(observationState),
    ['extracted', 'needsReview', 'accepted', 'accepted', 'rejected']
  )
})

test('preserves optional source polygons and rejects observations without sources', () => {
  const box = { x: 0.1, y: 0.2, width: 0.4, height: 0.05 }
  const points: [number, number][] = [
    [0.1, 0.2],
    [0.5, 0.21],
    [0.5, 0.25],
    [0.1, 0.24],
  ]
  const row = {
    id: 'observation',
    documentId: 'document',
    kind: 'lab' as const,
    name: 'Synthetic',
    value: '1',
    valueNumeric: '1',
    unit: null,
    effectiveDate: null,
    dateSource: null,
    sourceFormat: 'table' as const,
    source: [{ page: 2, blockId: 'table', box, points }],
    reviewStatus: 'unchecked' as const,
    details: {},
    removedByRedactionIds: [],
  }
  const mapped = observationSummary(row)
  assert.deepEqual(mapped.points, points)
  assert.deepEqual(mapped.box, box)
  assert.equal(mapped.page, 2)
  assert.equal(
    observationSummary({ ...row, source: [{ page: 2, blockId: 'table', box }] })
      .points,
    undefined
  )
  assert.throws(
    () => observationSummary({ ...row, source: [] }),
    /source is missing/
  )
})
