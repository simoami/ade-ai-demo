import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Block } from '#evals/fixtures/expected'
import {
  boxIoU,
  characterErrorRate,
  scoreBlocks,
  wordErrorRate,
} from '#evals/scorers/ocr'

test('edit rates count substitutions, deletions and insertions including empty references', () => {
  assert.equal(characterErrorRate('abc', 'axc'), 1 / 3)
  assert.equal(characterErrorRate('', 'ab'), 2)
  assert.equal(characterErrorRate('a  b\n', 'a b'), 0)
  assert.equal(wordErrorRate('one two three', 'one four'), 2 / 3)
  assert.equal(wordErrorRate('', ''), 0)
})

test('boxes score exact, partial and disjoint overlap', () => {
  const a = { x: 0, y: 0, width: 0.5, height: 0.5 }
  assert.equal(boxIoU(a, a), 1)
  assert.equal(boxIoU(a, { ...a, x: 0.25 }), 1 / 3)
  assert.equal(boxIoU(a, { ...a, x: 0.5 }), 0)
})

test('block alignment penalizes missing, extra and wrong-kind blocks independently of IDs', () => {
  const a: Block = {
    id: 'a',
    kind: 'paragraph',
    text: 'alpha',
    continues: null,
    box: { x: 0, y: 0, width: 0.5, height: 0.5 },
  }
  const b = { ...a, id: 'b', text: 'bravo' }
  assert.deepEqual(scoreBlocks([a, b], [a, b]), {
    cer: 0,
    wer: 0,
    blockKindAccuracy: 1,
    boxIoU: 1,
  })
  assert.equal(scoreBlocks([a, b], [b]).blockKindAccuracy, 0.5)
  assert.equal(scoreBlocks([a], [a, b]).boxIoU, 0.5)
  assert.equal(
    scoreBlocks([a], [{ ...a, id: 'model-id', kind: 'table' }])
      .blockKindAccuracy,
    0
  )
})

test('ceilings gate each variant on its page-mean CER and WER', async () => {
  const { exceededOcrCeilings } = await import('#evals/scorers/ocr')
  const page = (variant: 'clean' | 'scanned', cer: number, wer = 0) => ({
    variant,
    cer,
    wer,
  })
  assert.deepEqual(
    exceededOcrCeilings([page('clean', 0.01, 0.03), page('scanned', 0.03)]),
    []
  )
  assert.deepEqual(
    exceededOcrCeilings([page('scanned', 0.08), page('scanned', 0)]),
    ['scanned']
  )
  assert.deepEqual(exceededOcrCeilings([page('clean', 0, 0.031)]), ['clean'])
  assert.deepEqual(exceededOcrCeilings([page('clean', Number.NaN)]), ['clean'])
  assert.deepEqual(exceededOcrCeilings([]), [])
})
