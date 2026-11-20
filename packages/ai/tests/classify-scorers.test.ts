import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exceedsClassifyCeilings,
  scoreClassification,
  summaryLeaksIdentifier,
} from '#evals/scorers/classify'

test('scores accuracy, per-class F1 and counts failed cases as misses', () => {
  const scores = scoreClassification([
    { expected: 'clinical', actual: 'clinical' },
    { expected: 'clinical', actual: 'other' },
    { expected: 'consent', actual: 'consent' },
    { expected: 'other', actual: null },
  ])
  assert.equal(scores.accuracy, 0.5)
  assert.deepEqual(scores.perClass.clinical, {
    precision: 1,
    recall: 0.5,
    f1: 2 / 3,
    count: 2,
  })
  assert.deepEqual(scores.perClass.other, {
    precision: 0,
    recall: 0,
    f1: 0,
    count: 1,
  })
  assert.equal(scores.macroF1, (2 / 3 + 1 + 0) / 3)
})

test('scores an empty run as zero accuracy', () => {
  assert.equal(scoreClassification([]).accuracy, 0)
})

test('flags consent summaries that repeat an identifier in any case', () => {
  assert.equal(
    summaryLeaksIdentifier('Signed by BEX SAMPLEWICK.', ['Bex Samplewick']),
    true
  )
  assert.equal(
    summaryLeaksIdentifier('Authorizes treatment; signed and dated.', [
      'Bex Samplewick',
      'FAKE-7300',
    ]),
    false
  )
  assert.equal(summaryLeaksIdentifier(null, ['Bex Samplewick']), false)
  assert.equal(summaryLeaksIdentifier('Any text', ['  ']), false)
})

test('fails below perfect accuracy or on any summary leak', () => {
  assert.equal(exceedsClassifyCeilings(1, 0), false)
  assert.equal(exceedsClassifyCeilings(15 / 16, 0), true)
  assert.equal(exceedsClassifyCeilings(1, 1), true)
})
