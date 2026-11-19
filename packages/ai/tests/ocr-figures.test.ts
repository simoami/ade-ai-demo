import assert from 'node:assert/strict'
import { test } from 'node:test'
import { burnedInRecall, scoreFigures } from '#evals/scorers/figures'
import { scoreBlocks } from '#evals/scorers/ocr'
import type { Block } from '#stages/ocr/ocr-result'

const photo = { x: 0.7, y: 0.1, width: 0.2, height: 0.15 }

const figure = (box: Block['box'], text = ''): Block => ({
  id: `f-${box.x}`,
  kind: 'figure',
  text,
  box,
  continues: null,
})

test('figures match one-to-one at IoU 0.5 and count per kind', () => {
  const icon = { x: 0.06, y: 0.3, width: 0.02, height: 0.015 }
  const scores = scoreFigures(
    [
      { kind: 'patientPhoto', box: photo },
      { kind: 'icon', box: icon },
    ],
    [
      figure({ ...photo, x: 0.71 }),
      figure({ ...photo, x: 0.72 }),
      figure({ x: 0.3, y: 0.6, width: 0.1, height: 0.1 }),
    ]
  )

  assert.deepEqual(scores, {
    expected: 2,
    output: 3,
    matched: 1,
    byKind: {
      patientPhoto: { expected: 1, matched: 1 },
      icon: { expected: 1, matched: 0 },
    },
  })
})

test('burned-in recall searches all output text, ignoring case and spacing', () => {
  const output = [figure(photo, 'AVEN  TESTMERE\nfake-7314')]
  assert.equal(
    burnedInRecall(['Aven Testmere', 'FAKE-7314', '1978-04-12'], output),
    2 / 3
  )
  assert.equal(burnedInRecall([], output), null)
})

test('figure blocks are excluded from transcription scores', () => {
  const paragraph: Block = {
    id: 'p',
    kind: 'paragraph',
    text: 'clear lungs',
    box: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 },
    continues: null,
  }
  const scores = scoreBlocks([paragraph], [paragraph, figure(photo, 'LABEL')])
  assert.equal(scores.cer, 0)
  assert.equal(scores.blockKindAccuracy, 1)
})
