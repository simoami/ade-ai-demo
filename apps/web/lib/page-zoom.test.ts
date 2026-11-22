import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCoverScale, nextZoomStep } from './page-zoom.ts'

test('covers wide and tall viewports using the larger scale ratio', () => {
  assert.equal(
    getCoverScale({ width: 800, height: 600 }, { width: 400, height: 800 }),
    2
  )
  assert.equal(
    getCoverScale({ width: 400, height: 900 }, { width: 800, height: 600 }),
    1.5
  )
  assert.equal(
    getCoverScale({ width: 400, height: 600 }, { width: 800, height: 1200 }),
    0.5
  )
})

test('snaps to the next standard zoom level in either direction', () => {
  assert.equal(nextZoomStep(1.14, 'out'), 1)
  assert.equal(nextZoomStep(1, 'out'), 0.75)
  assert.equal(nextZoomStep(1.14, 'in'), 1.5)
  assert.equal(nextZoomStep(0.75, 'in'), 1)
  assert.equal(nextZoomStep(1.5, 'in'), 2)
  assert.equal(nextZoomStep(0.5, 'out'), undefined)
  assert.equal(nextZoomStep(3, 'in'), undefined)
})
