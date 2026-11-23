import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scoreNoteRecall } from '#evals/scorers/notes'

const expected = { fixtureId: 'synthetic', section: 'Plan', page: 2 }

test('scores retrieval only when fixture, section and page match', () => {
  assert.equal(scoreNoteRecall(expected, [expected]), 1)
  assert.equal(scoreNoteRecall(expected, []), 0)
  for (const mismatch of [
    { page: 1 },
    { section: 'Assessment' },
    { fixtureId: 'other' },
  ]) {
    assert.equal(scoreNoteRecall(expected, [{ ...expected, ...mismatch }]), 0)
  }
})
