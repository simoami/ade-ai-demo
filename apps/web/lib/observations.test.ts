import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  groupObservations,
  type ObservationView,
  observationFlag,
  observationTrends,
} from './observations.ts'

const observation: ObservationView = {
  id: 'lab-1',
  documentId: 'document-1',
  page: 1,
  kind: 'lab',
  name: 'Synthetic glucose',
  value: '100',
  valueNumeric: 100,
  unit: 'mg/dL',
  date: '2026-02-01',
  details: { rangeLow: 70, rangeHigh: 99 },
  state: 'extracted',
}

test('groups all six clinical kinds in domain order and preserves rows', () => {
  const rows = [
    { kind: 'symptom' as const, id: 's' },
    { kind: 'medication' as const, id: 'c' },
    { kind: 'vital' as const, id: 'v' },
    { kind: 'medical-history' as const, id: 'm' },
    { kind: 'lab' as const, id: 'l1' },
    { kind: 'adverse-event' as const, id: 'a' },
    { kind: 'lab' as const, id: 'l2' },
  ]
  const groups = groupObservations(rows)
  assert.deepEqual(
    groups.map((group) => group.title),
    [
      'Labs',
      'Vitals',
      'Adverse events',
      'Medical history',
      'Medications',
      'Symptoms',
    ]
  )
  assert.deepEqual(
    groups[0]?.observations.map((row) => row.id),
    ['l1', 'l2']
  )
  assert.deepEqual(groupObservations([]), [])
})

test('classifies numeric ranges inclusively and respects normalized flags', () => {
  for (const [valueNumeric, expected] of [
    [69, 'low'],
    [70, 'normal'],
    [99, 'normal'],
    [100, 'high'],
  ] as const) {
    assert.equal(observationFlag({ ...observation, valueNumeric }), expected)
  }
  assert.equal(
    observationFlag({
      ...observation,
      details: { flagNormalized: 'abnormal' },
    }),
    'abnormal'
  )
  assert.equal(
    observationFlag({
      ...observation,
      details: { ...observation.details, flagNormalized: 'normal' },
    }),
    'normal'
  )
  assert.equal(
    observationFlag({ ...observation, details: { rangeHigh: 99 } }),
    'high'
  )
  assert.equal(
    observationFlag({
      ...observation,
      valueNumeric: 60,
      details: { rangeLow: 70 },
    }),
    'low'
  )
  assert.equal(observationFlag({ ...observation, details: {} }), null)
  assert.equal(observationFlag({ ...observation, valueNumeric: null }), null)
  assert.equal(
    observationFlag({ ...observation, valueNumeric: Number.NaN }),
    null
  )
})

test('builds sorted cited series across documents, marking unverified points, without collapsing same-day results', () => {
  const later = {
    ...observation,
    state: 'accepted' as const,
    id: 'lab-2',
    documentId: 'document-2',
    page: 3,
    date: '2026-02-02',
    valueNumeric: 90,
  }
  const sameDay = { ...observation, id: 'lab-3', valueNumeric: 98 }
  const trends = observationTrends([later, sameDay, observation])
  assert.equal(trends.length, 1)
  assert.deepEqual(trends[0]?.points, [
    {
      date: '2026-02-01',
      value: 100,
      flag: 'high; unverified',
      documentId: 'document-1',
      page: 1,
    },
    {
      date: '2026-02-01',
      value: 98,
      flag: 'normal; unverified',
      documentId: 'document-1',
      page: 1,
    },
    {
      date: '2026-02-02',
      value: 90,
      flag: 'normal',
      documentId: 'document-2',
      page: 3,
    },
  ])
  assert.equal(trends[0]?.rangeHigh, 99)
})

test('excludes unusable points and keeps kind, name and unit series separate', () => {
  assert.deepEqual(
    observationTrends([
      observation,
      { ...observation, state: 'rejected' },
      { ...observation, valueNumeric: null },
      { ...observation, valueNumeric: Number.POSITIVE_INFINITY },
      { ...observation, date: '' },
      { ...observation, date: 'invalid' },
      { ...observation, kind: 'symptom' },
      { ...observation, name: 'Other' },
      { ...observation, unit: 'mmol/L' },
      { ...observation, kind: 'vital' },
    ]),
    []
  )
  assert.equal(
    observationTrends([
      { ...observation, kind: 'vital' },
      { ...observation, kind: 'vital', id: 'v2' },
    ]).length,
    1
  )
})
