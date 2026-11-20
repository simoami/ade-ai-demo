import assert from 'node:assert/strict'
import { test } from 'node:test'
import { patientFieldMatches } from './record-mapping.ts'

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
