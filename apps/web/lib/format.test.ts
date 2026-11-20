import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDate } from './format.ts'

test('formats known dates and displays unknown dates without crashing review', () => {
  assert.equal(formatDate('2026-11-19'), 'Nov 19, 2026')
  assert.equal(formatDate(''), 'Unknown date')
})
