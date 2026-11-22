import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observationBox } from '#stages/extract/observation-box'
import type { Block, Word } from '#stages/ocr/ocr-result'

const block: Block = {
  id: 'table',
  kind: 'table',
  text: 'Test Result Units\nGlucose 140 mg/dL\nSodium 140 mmol/L',
  box: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
  continues: null,
}

function line(text: string, y: number): Word[] {
  return text.split(' ').map((text, index) => ({
    text,
    blockId: block.id,
    box: { x: 0.1 + index * 0.3, y, width: 0.1, height: 0.02 },
  }))
}

const words = [
  ...line('Test Result Units', 0.15),
  ...line('Glucose 140 mg/dL', 0.25),
  ...line('Sodium 140 mmol/L', 0.35),
]

function assertLine(actual: ReturnType<typeof observationBox>, y: number) {
  assert.equal(actual.x, 0.1)
  assert.equal(actual.y, y)
  assert.ok(Math.abs(actual.width - 0.7) < 1e-12)
  assert.ok(Math.abs(actual.height - 0.02) < 1e-12)
}

test('selects the full matching table row without the header or other rows', () => {
  assertLine(
    observationBox(block, words, {
      name: 'GLUCOSE:',
      value: '140',
      valueNumeric: 140,
    }),
    0.25
  )
})

test('disambiguates duplicate values using the name on the same band', () => {
  assertLine(
    observationBox(block, words, {
      name: 'Sodium',
      value: '140.0',
      valueNumeric: 140,
    }),
    0.35
  )
})

test('selects only the matching narrative line', () => {
  assertLine(
    observationBox(
      { ...block, kind: 'paragraph' },
      [
        ...line('Reports mild fatigue.', 0.25),
        ...line('Walking without difficulty.', 0.35),
      ],
      { name: 'Fatigue', value: 'mild', valueNumeric: null }
    ),
    0.25
  )
})

test('falls back to the block when words or matches are missing', () => {
  const observation = { name: 'Potassium', value: '4.1', valueNumeric: 4.1 }
  for (const input of [
    undefined,
    [],
    words,
    words.map((word) => ({ ...word, blockId: 'other' })),
  ])
    assert.deepEqual(observationBox(block, input, observation), block.box)
})

test('clips row geometry to the block and falls back for wholly outside words', () => {
  const observation = { name: 'Glucose', value: '140', valueNumeric: 140 }
  const outside = {
    text: 'Glucose',
    blockId: block.id,
    box: { x: 0, y: 0.2, width: 1, height: 0.02 },
  }
  const clipped = observationBox(block, [outside], observation)
  assert.equal(clipped.x, block.box.x)
  assert.equal(clipped.width, block.box.width)
  assert.deepEqual(
    observationBox(
      block,
      [{ ...outside, box: { x: 0, y: 0, width: 0.01, height: 0.01 } }],
      observation
    ),
    block.box
  )
})
