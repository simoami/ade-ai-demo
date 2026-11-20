import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchStrength, pendingCount } from './review.ts'
import type { Redaction } from './sample-records.ts'

const none = {
  lastName: 'absent',
  firstName: 'absent',
  birthDate: 'absent',
  mrn: 'absent',
  sex: 'absent',
} as const

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

test('counts only items that still need review', () => {
  const box = { x: 0, y: 0, width: 0.1, height: 0.1 }
  const items: Redaction[] = [
    { id: 'r1', page: 1, category: 'Name', box, state: 'needsReview' },
    { id: 'r2', page: 1, category: 'Phone', box, state: 'accepted' },
    { id: 'r3', page: 1, category: 'Phone', box, state: 'applied' },
  ]
  assert.equal(pendingCount(items), 1)
})
