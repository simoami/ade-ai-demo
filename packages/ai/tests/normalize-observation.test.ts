import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ObservationDetails } from '@repo/db'
import { dedupeObservations } from '#stages/extract/dedupe-observations'
import {
  combineBloodPressure,
  normalizeLabDetails,
  normalizeObservation,
  normalizeSeriousness,
} from '#stages/extract/normalize-observation'

const observation = {
  kind: 'vital',
  name: 'BP',
  value: '120/70',
  valueNumeric: null,
  unit: 'mmHg',
  details: {
    code: '85354-9',
    components: [
      {
        code: '8480-6',
        name: 'Systolic blood pressure',
        value: 120,
        unit: 'mmHg',
      },
      {
        code: '8462-4',
        name: 'Diastolic blood pressure',
        value: 70,
        unit: 'mmHg',
      },
    ],
  } as ObservationDetails,
  effectiveDate: '2026-03-10',
  sourceFormat: 'list' as const,
}

test('preserves printed labels and coded components without a scalar BP value', () => {
  assert.deepEqual(normalizeObservation(observation), observation)
  for (const name of ['BMI', 'Body Mass Index', 'BP', 'Pulse']) {
    assert.equal(normalizeObservation({ ...observation, name }).name, name)
  }
  const lone = normalizeObservation({
    ...observation,
    name: 'SBP',
    value: '120',
    details: {
      code: '85354-9',
      flag: 'H',
      components: observation.details.components?.slice(0, 1),
    },
  })
  assert.equal(lone.name, 'SBP')
  assert.equal(lone.valueNumeric, null)
  assert.equal(lone.details.flag, 'H')
  assert.equal(lone.details.components?.length, 1)
})

test('pairs same-date BP components by code while retaining the first label and flags', () => {
  const systolic = {
    ...observation,
    name: 'SBP',
    value: '120',
    details: {
      code: '85354-9',
      flag: 'H',
      components: observation.details.components?.slice(0, 1),
    },
  }
  const diastolic = {
    ...observation,
    name: 'DBP',
    value: '70',
    details: {
      code: '85354-9',
      flag: '*',
      components: observation.details.components?.slice(1),
    },
  }
  const [panel] = combineBloodPressure(
    dedupeObservations([systolic, systolic, diastolic])
  )
  assert.equal(panel?.name, 'SBP')
  assert.equal(panel?.value, '120/70')
  assert.deepEqual(panel?.details.components, observation.details.components)
  assert.equal(panel?.details.flag, 'H; *')
  assert.equal(systolic.value, '120')
  assert.deepEqual(
    combineBloodPressure([diastolic, systolic])[0]?.details.components,
    observation.details.components
  )
  assert.equal(
    combineBloodPressure([
      systolic,
      { ...diastolic, effectiveDate: '2026-03-11' },
    ]).length,
    2
  )
  assert.equal(
    combineBloodPressure(
      [systolic, diastolic].map((row) => ({ ...row, effectiveDate: null }))
    ).length,
    2
  )
  assert.equal(combineBloodPressure([systolic, systolic]).length, 2)
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
      unit: null,
      details: {},
      name: 'Metformin',
      value: '500 mg',
    }).valueNumeric,
    500
  )
})
