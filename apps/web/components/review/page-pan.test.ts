import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPanPosition, hasPanOverflow } from './page-pan.ts'

test('allows panning when either axis overflows', () => {
  const area = {
    scrollWidth: 100,
    clientWidth: 100,
    scrollHeight: 200,
    clientHeight: 200,
  }

  assert.equal(hasPanOverflow(area), false)
  assert.equal(hasPanOverflow({ ...area, scrollWidth: 101 }), true)
  assert.equal(hasPanOverflow({ ...area, scrollHeight: 201 }), true)
  assert.equal(
    hasPanOverflow({ ...area, scrollWidth: 99, scrollHeight: 199 }),
    false
  )
})

test('pans both axes opposite the pointer displacement from the original offsets', () => {
  const origin = { pointerId: 1, x: 200, y: 300, left: 50, top: 100 }

  assert.deepEqual(
    getPanPosition(origin, { pointerId: 1, clientX: 150, clientY: 220 }),
    { left: 100, top: 180 }
  )
  assert.deepEqual(
    getPanPosition(origin, { pointerId: 1, clientX: 220, clientY: 350 }),
    { left: 30, top: 50 }
  )
  assert.deepEqual(
    getPanPosition(origin, { pointerId: 1, clientX: 200, clientY: 300 }),
    { left: 50, top: 100 }
  )
})

test('ignores movement from a different pointer', () => {
  assert.equal(
    getPanPosition(
      { pointerId: 1, x: 0, y: 0, left: 0, top: 0 },
      { pointerId: 2, clientX: 20, clientY: 20 }
    ),
    null
  )
})
