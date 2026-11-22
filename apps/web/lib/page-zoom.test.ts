import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCoverScale } from './page-zoom.ts'

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
