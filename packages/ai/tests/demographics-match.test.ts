import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  matchPatient,
  matchStrength,
  type PatientHashes,
} from '#stages/demographics/match-patient'

const absent = {
  lastName: 'absent',
  firstName: 'absent',
  birthDate: 'absent',
  mrn: 'absent',
} as const

const bex: PatientHashes = {
  id: 'patient-bex',
  lastNameHash: 'L1',
  firstNameHash: 'F1',
  birthDateHash: 'D1',
  mrnHash: 'M1',
  sex: 'Female',
}

const cora: PatientHashes = {
  id: 'patient-cora',
  lastNameHash: 'L2',
  firstNameHash: 'F2',
  birthDateHash: 'D1',
  mrnHash: 'M2',
  sex: 'Female',
}

test('treats an MRN match alone or full name and birth date as strong', () => {
  assert.equal(matchStrength({ ...absent, mrn: 'match' }), 'strong')
  assert.equal(
    matchStrength({
      lastName: 'match',
      firstName: 'match',
      birthDate: 'match',
      mrn: 'mismatch',
    }),
    'strong'
  )
})

test('treats any other matching identifier as partial and no match as none', () => {
  assert.equal(
    matchStrength({ ...absent, lastName: 'match', firstName: 'match' }),
    'partial'
  )
  assert.equal(
    matchStrength({ ...absent, birthDate: 'match', mrn: 'mismatch' }),
    'partial'
  )
  assert.equal(matchStrength({ ...absent, mrn: 'mismatch' }), 'none')
  assert.equal(matchStrength(absent), 'none')
})

test('links a strong MRN match even when names differ', () => {
  assert.deepEqual(
    matchPatient({ hashes: { mrn: 'M2', lastName: 'X' }, sex: null }, [
      bex,
      cora,
    ]),
    { patientId: 'patient-cora', strength: 'strong' }
  )
})

test('prefers a strong candidate over a partial one listed first', () => {
  assert.deepEqual(
    matchPatient(
      {
        hashes: { lastName: 'L2', firstName: 'F2', birthDate: 'D1' },
        sex: 'Female',
      },
      [bex, cora]
    ),
    { patientId: 'patient-cora', strength: 'strong' }
  )
})

test('links the partial candidate with the most matching identifiers', () => {
  assert.deepEqual(
    matchPatient(
      {
        hashes: { lastName: 'L2', firstName: 'F2', birthDate: 'D9' },
        sex: null,
      },
      [bex, cora]
    ),
    { patientId: 'patient-cora', strength: 'partial' }
  )
})

test('breaks equal partial matches on sex, then on patient order', () => {
  const male = { ...cora, id: 'patient-male', sex: 'Male' }
  const document = { hashes: { birthDate: 'D1' }, sex: 'Male' }
  assert.deepEqual(matchPatient(document, [bex, male]), {
    patientId: 'patient-male',
    strength: 'partial',
  })
  assert.deepEqual(matchPatient({ ...document, sex: null }, [bex, male]), {
    patientId: 'patient-bex',
    strength: 'partial',
  })
})

test('does not link on sex alone, mismatches or missing identifiers', () => {
  assert.deepEqual(matchPatient({ hashes: {}, sex: 'Female' }, [bex, cora]), {
    patientId: null,
    strength: 'none',
  })
  assert.deepEqual(
    matchPatient({ hashes: { mrn: 'M9', lastName: 'L9' }, sex: null }, [bex]),
    { patientId: null, strength: 'none' }
  )
  assert.deepEqual(matchPatient({ hashes: { mrn: 'M1' }, sex: null }, []), {
    patientId: null,
    strength: 'none',
  })
})
