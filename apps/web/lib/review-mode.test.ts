import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DocumentStatus } from './records-types.ts'
import { reviewMode } from './review.ts'

test('allows changes only to documents awaiting review', () => {
  assert.equal(reviewMode('needsReview'), 'review')

  for (const status of [
    'reviewed',
    'discarded',
    'unsupported',
    'failed',
  ] satisfies DocumentStatus[]) {
    assert.equal(reviewMode(status), 'read-only')
  }
})

test('keeps every processing stage out of review', () => {
  for (const status of [
    'rendering',
    'reading',
    'redacting',
    'extracting',
  ] satisfies DocumentStatus[]) {
    assert.equal(reviewMode(status), 'processing')
  }
})
