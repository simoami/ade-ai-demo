import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reviewActionSchema, reviewToken } from './review-action.ts'

const REDACTION_ID = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

test('accepts terminal actions and redaction decisions', () => {
  for (const value of [
    { type: 'markReviewed' },
    { type: 'discard' },
    ...['accepted', 'rejected'].map((status) => ({
      type: 'redaction.update',
      redactionId: REDACTION_ID,
      status,
    })),
  ])
    assert.equal(reviewActionSchema.safeParse(value).success, true)
})

test('rejects unknown actions, content, missing IDs and invalid statuses', () => {
  for (const value of [
    null,
    {},
    { type: 'other' },
    { type: 'markReviewed', text: 'content' },
    { type: 'redaction.update', status: 'accepted' },
    { type: 'redaction.update', redactionId: '../file', status: 'accepted' },
    { type: 'redaction.update', redactionId: REDACTION_ID, status: 'other' },
  ])
    assert.equal(reviewActionSchema.safeParse(value).success, false)
})

test("uses a deterministic document-specific hook outside eve's namespace", () => {
  assert.equal(reviewToken(REDACTION_ID), `document:${REDACTION_ID}:review`)
})
