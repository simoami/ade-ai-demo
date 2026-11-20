import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Redaction } from './records-types.ts'
import { matchStrength, pendingCount, redactionIconKind } from './review.ts'

const none = {
  lastName: 'absent',
  firstName: 'absent',
  birthDate: 'absent',
  mrn: 'absent',
  sex: 'absent',
} as const

test('uses text icons for raw and seeded identifier categories', () => {
  for (const category of [
    'name',
    'dob',
    'id',
    'address',
    'phone',
    'email',
    'ssn',
    'facility',
    'provider',
    'Name',
    'Date of birth',
    'Record number',
    'Address',
    'Phone',
    'Email',
    'Social security number',
    'Facility',
    'Provider',
  ]) {
    assert.equal(redactionIconKind(category), 'text', category)
  }
})

test('distinguishes picture kinds and falls back to an image for unknown categories', () => {
  for (const category of ['patientPhoto', 'Patient photo']) {
    assert.equal(redactionIconKind(category), 'patientPhoto')
  }

  for (const category of ['face', 'Unidentified face']) {
    assert.equal(redactionIconKind(category), 'face')
  }

  assert.equal(redactionIconKind('Signature'), 'signature')
  assert.equal(redactionIconKind('signature'), 'signature')
  assert.equal(redactionIconKind('other'), 'picture')
  assert.equal(redactionIconKind('medicalImage'), 'picture')
  assert.equal(redactionIconKind(''), 'picture')
})

test('links on an MRN match alone or on full name and date of birth', () => {
  assert.equal(matchStrength({ ...none, mrn: 'match' }), 'strong')
  assert.equal(
    matchStrength({
      ...none,
      lastName: 'match',
      firstName: 'match',
      birthDate: 'match',
      mrn: 'mismatch',
    }),
    'strong'
  )
})

test('treats any other matching identifier as partial and none as no match', () => {
  assert.equal(
    matchStrength({ ...none, birthDate: 'match', lastName: 'mismatch' }),
    'partial'
  )
  assert.equal(matchStrength({ ...none, lastName: 'mismatch' }), 'none')
})

test('does not treat a matching sex alone as a partial match', () => {
  assert.equal(matchStrength({ ...none, sex: 'match' }), 'none')
})

test('counts only items that still need review', () => {
  const box = { x: 0, y: 0, width: 0.1, height: 0.1 }
  const items: Redaction[] = [
    {
      id: 'r1',
      page: 1,
      category: 'Name',
      box,
      points: [],
      state: 'needsReview',
    },
    {
      id: 'r2',
      page: 1,
      category: 'Phone',
      box,
      points: [],
      state: 'accepted',
    },
    { id: 'r3', page: 1, category: 'Phone', box, points: [], state: 'applied' },
  ]
  assert.equal(pendingCount(items), 1)
})
