import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OUTLINE_PADDING, outsetOutline } from './page-outline.ts'

test('outsets rectangles by the outline padding at every rendered size and winding', () => {
  for (const zoom of [1, 1.5, 3]) {
    const points: [number, number][] = [
      [10 * zoom, 20 * zoom],
      [30 * zoom, 20 * zoom],
      [30 * zoom, 40 * zoom],
      [10 * zoom, 40 * zoom],
    ]
    const expected = [
      [10 * zoom - OUTLINE_PADDING, 20 * zoom - OUTLINE_PADDING],
      [30 * zoom + OUTLINE_PADDING, 20 * zoom - OUTLINE_PADDING],
      [30 * zoom + OUTLINE_PADDING, 40 * zoom + OUTLINE_PADDING],
      [10 * zoom - OUTLINE_PADDING, 40 * zoom + OUTLINE_PADDING],
    ]

    assert.deepEqual(outsetOutline(points), expected)
    assert.deepEqual(
      outsetOutline([...points].reverse()),
      [...expected].reverse()
    )
  }
})

test('outsets slanted polygon edges at a perpendicular distance of the outline padding', () => {
  const points: [number, number][] = [
    [0, 10],
    [10, 0],
    [20, 10],
    [10, 20],
  ]
  const result = outsetOutline(points)

  for (const [index, point] of result.entries()) {
    const start = points[index]
    const end = points[(index + 1) % points.length]

    assert.ok(start && end)
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const distance =
      Math.abs(dx * (point[1] - start[1]) - dy * (point[0] - start[0])) /
      Math.hypot(dx, dy)

    assert.ok(Math.abs(distance - OUTLINE_PADDING) < 1e-8)
  }
})

test('handles repeated, empty and degenerate vertices without nonfinite coordinates', () => {
  assert.deepEqual(outsetOutline([]), [])
  assert.deepEqual(
    outsetOutline([
      [1, 1],
      [1, 1],
      [1, 1],
    ]),
    []
  )
  assert.deepEqual(
    outsetOutline([
      [0, 0],
      [1, 1],
      [2, 2],
    ]),
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ]
  )
  assert.deepEqual(
    outsetOutline([
      [0, 0],
      [10, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]),
    [
      [12, -2],
      [12, 12],
      [-2, 12],
      [-2, -2],
    ]
  )
})
