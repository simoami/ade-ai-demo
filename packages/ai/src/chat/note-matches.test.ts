import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectNoteMatches } from './note-matches.ts'

test('returns at most four chunks ordered by relevance', () => {
  const rows = [0.6, 0.1, 0.4, 0.2, 0.5, 0.3].map((distance) => ({ distance }))

  assert.deepEqual(
    selectNoteMatches(rows).map((row) => row.distance),
    [0.1, 0.2, 0.3, 0.4]
  )
})

test('drops weak and invalid matches while retaining the similarity threshold', () => {
  assert.deepEqual(
    selectNoteMatches(
      [0.85, 0.851, 1, NaN, Infinity].map((distance) => ({ distance }))
    ),
    [{ distance: 0.85 }]
  )
  assert.deepEqual(selectNoteMatches([]), [])
})
