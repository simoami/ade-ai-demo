import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exceedsDemographicsCeilings,
  fieldAccuracy,
  isWrongStrongLink,
  scoreDemographicFields,
} from '#evals/scorers/demographics'
import { hashDemographics } from '#stages/demographics/read-demographics'

const key = Buffer.alloc(32, 1).toString('base64')

test('compares fields after the linking normalization and counts shared absence as correct', () => {
  const expected = hashDemographics(
    { firstName: 'Bex', lastName: 'Samplewick', mrn: 'FAKE-7300' },
    key
  )
  const actual = hashDemographics(
    { firstName: 'BEX', lastName: 'Samplewik', mrn: 'fake 7300' },
    key
  )
  assert.deepEqual(scoreDemographicFields(expected, actual), {
    lastName: false,
    firstName: true,
    birthDate: true,
    mrn: true,
  })
  assert.equal(scoreDemographicFields({ mrn: expected.mrn }, {}).mrn, false)
})

test('averages accuracy per field and over all fields', () => {
  const correct = {
    lastName: true,
    firstName: true,
    birthDate: true,
    mrn: true,
  }
  assert.deepEqual(fieldAccuracy([correct, { ...correct, mrn: false }]), {
    lastName: 1,
    firstName: 1,
    birthDate: 1,
    mrn: 0.5,
    total: 0.875,
  })
  assert.equal(fieldAccuracy([]).total, 0)
})

test('treats only automatic links to the wrong patient or without strong truth as wrong', () => {
  const strong = { patientId: 'a', strength: 'strong' } as const
  assert.equal(isWrongStrongLink(strong, strong), false)
  assert.equal(isWrongStrongLink(strong, { ...strong, patientId: 'b' }), true)
  assert.equal(
    isWrongStrongLink({ patientId: 'a', strength: 'partial' }, strong),
    true
  )
  assert.equal(
    isWrongStrongLink(strong, { patientId: 'a', strength: 'partial' }),
    false
  )
})

test('fails below the field floor or on any wrong automatic link', () => {
  const perfect = { lastName: 1, firstName: 1, birthDate: 1, mrn: 1 }
  assert.equal(exceedsDemographicsCeilings(perfect, 0), false)
  assert.equal(exceedsDemographicsCeilings({ ...perfect, mrn: 0.85 }, 0), true)
  assert.equal(exceedsDemographicsCeilings(perfect, 1), true)
})
