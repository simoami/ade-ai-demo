import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exceedsPiiCeilings,
  scoreIdentifierCharacters,
  scorePictureDecisions,
} from '#evals/scorers/pii'
import type {
  IdentifierSpan,
  PictureFinding,
} from '#stages/redact/redaction-types'

const span: IdentifierSpan = {
  page: 1,
  blockId: 'p1-b1',
  start: 2,
  end: 6,
  category: 'name',
  confidence: 1,
}

test('counts partial character recall and precision without rewarding duplicates', () => {
  const score = scoreIdentifierCharacters(
    [span],
    [
      { ...span, start: 4, end: 8 },
      { ...span, start: 4, end: 8 },
    ]
  )
  assert.deepEqual(score.total, {
    expected: 4,
    predicted: 4,
    matched: 2,
    recall: 0.5,
    precision: 0.5,
  })
})

test('counts hidden characters regardless of label, and labels per category', () => {
  for (const changed of [{ page: 2 }, { blockId: 'p1-b2' }])
    assert.equal(
      scoreIdentifierCharacters([span], [{ ...span, ...changed }]).total.recall,
      0
    )
  const relabeled = scoreIdentifierCharacters(
    [span],
    [{ ...span, category: 'provider' }]
  )
  assert.equal(relabeled.total.recall, 1)
  assert.equal(
    relabeled.categories.find(({ category }) => category === 'name')?.recall,
    0
  )
  assert.equal(scoreIdentifierCharacters([span], []).total.recall, 0)
  assert.equal(scoreIdentifierCharacters([], []).total.precision, 1)
})

test('penalizes wrong and missing picture decisions', () => {
  const finding: PictureFinding = {
    page: 1,
    blockId: 'p1-b2',
    kind: 'face',
    decision: 'keep',
    confidence: 1,
    identifiers: [],
  }
  assert.equal(scorePictureDecisions([finding], [finding]).accuracy, 1)
  assert.equal(scorePictureDecisions([finding], []).accuracy, 0)
  assert.equal(
    scorePictureDecisions([finding], [{ ...finding, decision: 'redact' }])
      .accuracy,
    0
  )
})

test('enforces privacy recall, precision and picture accuracy ceilings', () => {
  assert.equal(exceedsPiiCeilings(0.99, 0.95, 1), false)
  assert.equal(exceedsPiiCeilings(0.989, 1, 1), true)
  assert.equal(exceedsPiiCeilings(1, 0.949, 1), true)
  assert.equal(exceedsPiiCeilings(1, 1, 0.99), true)
})
