import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observationBox } from '#stages/extract/observation-box'
import type { Block, Word } from '#stages/ocr/ocr-result'
import { pageSkew } from '#stages/ocr/page-skew'

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

test('outlines a stacked label and its combined value without neighbouring fields', () => {
  const grid = { ...block, kind: 'other' as const }
  const field = (text: string, x: number, y: number): Word => ({
    text,
    blockId: block.id,
    box: { x, y, width: 0.08, height: 0.02 },
  })
  const actual = observationBox(
    grid,
    [
      field('Blood', 0.1, 0.15),
      field('Pressure', 0.19, 0.15),
      field('Heart', 0.4, 0.15),
      field('Rate', 0.49, 0.15),
      field('128/78', 0.1, 0.2),
      field('76', 0.4, 0.2),
    ],
    { name: 'Systolic blood pressure', value: '128', valueNumeric: 128 }
  )
  assert.equal(actual.x, 0.1)
  assert.equal(actual.y, 0.15)
  assert.ok(Math.abs(actual.width - 0.17) < 1e-12)
  assert.ok(Math.abs(actual.height - 0.07) < 1e-12)
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

const ASPECT_RATIO = 612 / 792

function tiltedTable(degrees: number): Word[] {
  const angle = (degrees * Math.PI) / 180
  return ['Glucose', 'Sodium', 'Potassium'].flatMap((name, row) =>
    [
      name,
      'synthetic',
      'cell',
      'cell',
      'cell',
      'cell',
      'cell',
      'cell',
      '140',
      'units',
    ].map((text, column) => {
      const x = 0.1 + column * 0.075
      const y = 0.2 + row * 0.018
      const corners = [
        [x, y],
        [x + 0.045, y],
        [x + 0.045, y + 0.008],
        [x, y + 0.008],
      ].map(([px = 0, py = 0]) => [
        (px * ASPECT_RATIO * Math.cos(angle) - py * Math.sin(angle)) /
          ASPECT_RATIO,
        px * ASPECT_RATIO * Math.sin(angle) + py * Math.cos(angle),
      ])
      const xs = corners.map(([px = 0]) => px)
      const ys = corners.map(([, py = 0]) => py)
      return {
        text,
        blockId: block.id,
        box: {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        },
      }
    })
  )
}

test('estimates pixel-proportional skew on positive, negative and untilted tables', () => {
  for (const degrees of [2.5, -3, 0]) {
    assert.ok(
      Math.abs(
        pageSkew(tiltedTable(degrees), ASPECT_RATIO) - (degrees * Math.PI) / 180
      ) < 1e-12
    )
  }
})

test('requires three same-block overlapping pairs and ignores angles above ten degrees', () => {
  assert.equal(pageSkew(undefined, ASPECT_RATIO), 0)
  assert.equal(pageSkew(tiltedTable(2.5).slice(0, 3), ASPECT_RATIO), 0)
  assert.equal(
    pageSkew(
      tiltedTable(2.5).map((word, index) => ({
        ...word,
        blockId: String(index),
      })),
      ASPECT_RATIO
    ),
    0
  )
  const steep = Array.from({ length: 5 }, (_, index) => ({
    text: 'synthetic',
    blockId: block.id,
    box: {
      x: 0.1 + index * 0.05,
      y: 0.1 + index * 0.02,
      width: 0.03,
      height: 0.03,
    },
  }))
  assert.equal(pageSkew(steep, ASPECT_RATIO), 0)
  assert.equal(
    pageSkew(
      steep.map((word) => ({ ...word, blockId: undefined })),
      ASPECT_RATIO
    ),
    0
  )
})

test('selects only its tilted row across drift greater than word height and encloses every word', () => {
  const words = tiltedTable(2.5)
  const angle = pageSkew(words, ASPECT_RATIO)
  const wideBlock = {
    ...block,
    box: { x: 0.01, y: 0.1, width: 0.95, height: 0.6 },
  }
  const result = observationBox(
    wideBlock,
    words,
    { name: 'Sodium', value: '140', valueNumeric: 140 },
    { angle, aspectRatio: ASPECT_RATIO }
  )
  assert.ok(result.points)
  assert.equal(result.points.length, 4)
  const deskew = ([x, y]: [number, number]) => [
    x * ASPECT_RATIO * Math.cos(angle) + y * Math.sin(angle),
    -x * ASPECT_RATIO * Math.sin(angle) + y * Math.cos(angle),
  ]
  const polygon = result.points.map(deskew)
  const left = polygon[0]?.[0] ?? NaN
  const top = polygon[0]?.[1] ?? NaN
  const right = polygon[2]?.[0] ?? NaN
  const bottom = polygon[2]?.[1] ?? NaN
  assert.ok(Math.abs((polygon[1]?.[1] ?? NaN) - top) < 1e-12)
  assert.ok(Math.abs((polygon[3]?.[0] ?? NaN) - left) < 1e-12)
  assert.ok((result.points[1]?.[1] ?? 0) - (result.points[0]?.[1] ?? 0) > 0.008)
  for (const [index, word] of words.entries()) {
    const { x, y, width, height } = word.box
    if (index >= 10 && index < 20) {
      for (const point of [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
      ] as [number, number][]) {
        const [px = NaN, py = NaN] = deskew(point)
        assert.ok(
          px >= left - 1e-12 &&
            px <= right + 1e-12 &&
            py >= top - 1e-12 &&
            py <= bottom + 1e-12
        )
      }
    } else {
      const [, py = NaN] = deskew([x + width / 2, y + height / 2])
      assert.ok(py < top || py > bottom)
    }
  }
  for (const [x, y] of result.points) {
    assert.ok(x >= result.x - 1e-12 && x <= result.x + result.width + 1e-12)
    assert.ok(y >= result.y - 1e-12 && y <= result.y + result.height + 1e-12)
  }
  assert.deepEqual(
    observationBox(
      wideBlock,
      undefined,
      { name: 'Sodium', value: '140', valueNumeric: 140 },
      { angle, aspectRatio: ASPECT_RATIO }
    ),
    wideBlock.box
  )
})
