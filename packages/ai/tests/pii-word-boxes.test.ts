import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  scorePiiWordBoxes,
  summarizePiiWordBoxes,
} from '#evals/scorers/pii-word-boxes'

const span = {
  text: 'Bex Samplewick',
  box: { x: 0.1, y: 0.1, width: 0.2, height: 0.02 },
}

function word(text: string, x: number, width: number, y = 0.1) {
  return { text, box: { x, y, width, height: 0.02 } }
}

test('word boxes that tile the span box score full coverage and no over-coverage', () => {
  const words = [
    word('Name:', 0, 0.08),
    word('Bex', 0.1, 0.06),
    word('Samplewick', 0.16, 0.14),
  ]

  const [score] = scorePiiWordBoxes([span], words)
  assert.ok(score)
  assert.ok(Math.abs(score.coverage - 1) < 1e-9)
  assert.ok(Math.abs(score.overCoverage ?? 1) < 1e-9)
})

test('partial and oversized word boxes report missed area and area outside the span', () => {
  const [score] = scorePiiWordBoxes(
    [span],
    [word('Bex', 0.1, 0.06), word('Samplewick,', 0.16, 0.24)]
  )
  assert.ok(score)
  assert.ok(Math.abs(score.coverage - 1) < 1e-9)
  assert.ok(Math.abs((score.overCoverage ?? 0) - 0.1 / 0.3) < 1e-9)

  const [short] = scorePiiWordBoxes(
    [span],
    [word('Bex', 0.1, 0.06), word('Samplewick', 0.2, 0.1)]
  )
  assert.ok(short)
  assert.ok(Math.abs(short.coverage - 0.8) < 1e-9)
})

test('repeated text keeps the occurrence covering the span box', () => {
  const [score] = scorePiiWordBoxes(
    [span],
    [
      word('Bex', 0.1, 0.06, 0.8),
      word('Samplewick', 0.16, 0.14, 0.8),
      word('Bex', 0.1, 0.06),
      word('Samplewick', 0.16, 0.14),
    ]
  )
  assert.ok(Math.abs((score?.coverage ?? 0) - 1) < 1e-9)
})

test('misread or absent text scores zero coverage and no over-coverage', () => {
  const scores = scorePiiWordBoxes(
    [span, { ...span, text: '1978-04-12' }],
    [word('Bex', 0.1, 0.06), word('Sarnplewick', 0.16, 0.14)]
  )
  assert.deepEqual(scores, [
    { coverage: 0, overCoverage: null },
    { coverage: 0, overCoverage: null },
  ])
  assert.deepEqual(summarizePiiWordBoxes(scores), {
    coverage: 0,
    overCoverage: null,
  })
})

test('summaries average coverage over spans and over-coverage over matched spans', () => {
  assert.deepEqual(
    summarizePiiWordBoxes([
      { coverage: 1, overCoverage: 0.2 },
      { coverage: 0, overCoverage: null },
    ]),
    { coverage: 0.5, overCoverage: 0.2 }
  )
  assert.deepEqual(summarizePiiWordBoxes([]), {
    coverage: null,
    overCoverage: null,
  })
})
