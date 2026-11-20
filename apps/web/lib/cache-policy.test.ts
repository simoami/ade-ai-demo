import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTerminalDocument, recordTags } from './cache-policy.ts'

test('caches only immutable terminal document states', () => {
  for (const status of ['reviewed', 'discarded', 'unsupported'] as const) {
    assert.equal(isTerminalDocument(status), true)
  }
})

test('keeps processing, review and failed documents live', () => {
  for (const status of [
    'rendering',
    'reading',
    'redacting',
    'extracting',
    'needsReview',
    'failed',
  ] as const) {
    assert.equal(isTerminalDocument(status), false)
  }
})

test('scopes document and patient tags independently', () => {
  assert.equal(recordTags.document('123'), 'document:123')
  assert.equal(recordTags.patient('123'), 'patient:123')
})
