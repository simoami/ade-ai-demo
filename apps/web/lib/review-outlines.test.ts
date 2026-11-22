import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Observation, Redaction } from './records-types.ts'
import { reviewOutlines } from './review-outlines.ts'

const box = { x: 0.1, y: 0.2, width: 0.4, height: 0.05 }

const points: [number, number][] = [
  [0.1, 0.2],
  [0.5, 0.21],
  [0.5, 0.25],
  [0.1, 0.24],
]

const observation: Observation = {
  id: 'observation',
  page: 1,
  kind: 'lab',
  name: 'Synthetic',
  value: '1',
  unit: '',
  date: '',
  box,
  points,
  state: 'extracted',
}

const redaction: Redaction = {
  id: 'redaction',
  page: 1,
  category: 'name',
  box,
  points,
  state: 'needsReview',
}

test('spotlights selected observations with or without polygons and never redactions', () => {
  for (const sourcePoints of [points, undefined]) {
    const outlines = reviewOutlines(
      [redaction],
      [{ ...observation, points: sourcePoints }],
      1,
      observation.id
    )
    assert.equal(
      outlines.find((item) => item.id === observation.id)?.spotlight,
      true
    )
    assert.deepEqual(
      outlines.find((item) => item.id === observation.id)?.points,
      sourcePoints
    )
    assert.equal(
      outlines.find((item) => item.id === redaction.id)?.spotlight,
      false
    )
  }
  assert.ok(
    reviewOutlines([redaction], [observation], 1, redaction.id).every(
      (item) => !item.spotlight
    )
  )
})

test('limits outlines to the visible page and selected or pending regions', () => {
  assert.deepEqual(
    reviewOutlines([redaction], [observation], 2, observation.id),
    []
  )
  assert.deepEqual(reviewOutlines([], [observation], 1, undefined), [])
  assert.equal(reviewOutlines([redaction], [], 1, undefined)[0]?.tone, 'review')
  assert.equal(
    reviewOutlines([], [observation], 1, observation.id)[0]?.tone,
    'selected'
  )
})
