import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeLabDetails,
  normalizeObservation,
  normalizeSeriousness,
} from '#stages/extract/normalize-observation'
import { documentScopedId } from '#workflows/ingest-document/deterministic-id'

const observation = {
  kind: 'vital',
  name: 'BP',
  value: '120/70',
  valueNumeric: null,
  unit: null,
  details: {},
}

test('splits combined BP and canonicalizes separately printed SBP and DBP to identical readings', () => {
  const combined = normalizeObservation(observation)
  const separate = [
    ...normalizeObservation({
      ...observation,
      name: 'SBP',
      value: '120',
      valueNumeric: 120,
    }),
    ...normalizeObservation({
      ...observation,
      name: 'BP diastolic',
      value: '70',
      valueNumeric: 70,
    }),
  ]
  assert.deepEqual(combined, separate)
  const ids = combined.map(({ name }) =>
    documentScopedId(
      'f5947cf9-48ef-4354-8c39-c1bba1444319',
      `observation:1:b1:${name}:2026-03-10`
    )
  )
  assert.equal(new Set(ids).size, 2)
  assert.deepEqual(
    ids,
    separate.map(({ name }) =>
      documentScopedId(
        'f5947cf9-48ef-4354-8c39-c1bba1444319',
        `observation:1:b1:${name}:2026-03-10`
      )
    )
  )
  for (const name of ['Systolic BP', 'BP systolic', 'systolic blood pressure'])
    assert.equal(
      normalizeObservation({
        ...observation,
        name,
        value: '120',
        valueNumeric: 120,
      })[0]?.name,
      'Systolic blood pressure'
    )
  assert.equal(
    normalizeObservation({ ...observation, name: 'Pulse', value: '70' })[0]
      ?.name,
    'Pulse'
  )
})

test('parses lab intervals and one-sided ranges and derives or preserves printed flags', () => {
  for (const [referenceRange, value, rangeLow, rangeHigh, flagNormalized] of [
    ['70-99', 110, 70, 99, 'high'],
    ['70–99', 60, 70, 99, 'low'],
    ['<5.7', 5.7, null, 5.7, 'high'],
    ['>60', 60, 60, null, 'low'],
    ['<=5.7', 5.7, null, 5.7, 'normal'],
    ['≥60', 60, 60, null, 'normal'],
    ['negative', 0, null, null, null],
  ] as const) {
    assert.deepEqual(normalizeLabDetails({ referenceRange }, value), {
      referenceRange,
      rangeLow,
      rangeHigh,
      flagNormalized,
    })
  }
  assert.equal(
    normalizeLabDetails({ referenceRange: '70-99', flag: 'L' }, 120)
      .flagNormalized,
    'low'
  )
  assert.equal(
    normalizeLabDetails({ flag: 'abnormal' }, null).flagNormalized,
    'abnormal'
  )
  assert.equal(normalizeLabDetails({}, null).flagNormalized, null)
})

test('derives serious independently of severity and parses medication doses', () => {
  assert.equal(normalizeSeriousness('non-serious'), false)
  assert.equal(normalizeSeriousness('not serious'), false)
  assert.equal(normalizeSeriousness('serious (hospitalization)'), true)
  assert.equal(normalizeSeriousness('severe'), null)
  assert.equal(normalizeSeriousness(undefined), null)
  assert.equal(
    normalizeObservation({
      ...observation,
      kind: 'medication',
      name: 'Metformin',
      value: '500 mg',
    })[0]?.valueNumeric,
    500
  )
})
