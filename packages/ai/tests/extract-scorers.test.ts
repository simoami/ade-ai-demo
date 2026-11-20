import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Expected } from '#evals/fixtures/expected'
import {
  exceedsExtractionCeilings,
  keptObservations,
  scoreObservations,
} from '#evals/scorers/extract'

type Truth = Expected['observations'][number]

const truth = (
  id: string,
  sourceFormat: Truth['sourceFormat'],
  changes: Partial<Truth> = {}
): Truth => ({
  id,
  blockId: 'p1-b1',
  kind: 'lab',
  name: 'Glucose',
  value: '133',
  unit: 'mg/dL',
  effectiveDate: '2026-02-10',
  sourceFormat,
  details: {},
  duplicateGroup: 'Glucose-2026-02-10',
  ...changes,
})

const pulse = truth('pulse', 'list', {
  kind: 'vital',
  name: 'Pulse',
  value: '76',
  unit: 'beats/min',
  duplicateGroup: 'Pulse-2026-02-10',
})

const expected = [
  truth('narrative', 'narrative'),
  truth('table', 'table'),
  pulse,
]

test('keeps the preferred source format per duplicate group', () => {
  assert.deepEqual(
    keptObservations(expected).map(({ id }) => id),
    ['table', 'pulse']
  )
})

test('matches on normalized name, value and date and scores units among matches', () => {
  const score = scoreObservations([
    {
      expected,
      actual: [
        { ...truth('a', 'table'), name: ' glucose', unit: 'MG/DL' },
        { ...pulse, unit: 'bpm' },
        { ...truth('b', 'table'), effectiveDate: '2026-02-11' },
      ],
    },
  ])
  assert.deepEqual(score, {
    expected: 2,
    predicted: 3,
    matched: 2,
    recall: 1,
    precision: 2 / 3,
    unitAccuracy: 0.5,
    dedupeAccuracy: 1,
  })
})

test('fails dedupe when duplicates survive or the wrong format is kept', () => {
  const kept = scoreObservations([
    {
      expected,
      actual: [
        truth('a', 'table'),
        truth('b', 'narrative'),
        truth('c', 'narrative', {
          name: 'Pulse',
          value: '76',
          unit: 'beats/min',
        }),
      ],
    },
  ])
  assert.equal(kept.dedupeAccuracy, 0)
  assert.equal(kept.recall, 1)
})

test('handles empty documents and applies ceilings', () => {
  const empty = scoreObservations([{ expected: [], actual: [] }])
  assert.equal(empty.recall, 1)
  assert.equal(empty.precision, 1)
  assert.equal(empty.unitAccuracy, null)
  assert.equal(scoreObservations([{ expected, actual: [] }]).recall, 0)
  assert.equal(
    scoreObservations([{ expected: [], actual: [truth('a', 'table')] }])
      .precision,
    0
  )
  assert.equal(
    exceedsExtractionCeilings(scoreObservations([{ expected, actual: [] }])),
    true
  )
  assert.equal(
    exceedsExtractionCeilings(
      scoreObservations([{ expected, actual: keptObservations(expected) }])
    ),
    false
  )
})
