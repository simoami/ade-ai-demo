import assert from 'node:assert/strict'
import { test } from 'node:test'
import { models } from '#models'
import {
  classifyDocument,
  validateClassification,
} from '#stages/classify/classify-document'
import { buildDocumentPrompt } from '#stages/classify/prompt'
import type { OcrPage } from '#stages/ocr/ocr-result'

const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const ocr: OcrPage = {
  blocks: [
    {
      id: 'p1-b1',
      kind: 'paragraph',
      text: 'I authorize treatment.',
      box,
      continues: null,
    },
    { id: 'p1-f1', kind: 'figure', text: '', box, continues: null },
  ],
  usage: { latencyMs: 0 },
}

function modelOutput(output: unknown) {
  return async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(output) }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  })
}

test('requires a trimmed summary for consent documents', () => {
  assert.deepEqual(
    validateClassification({
      documentClass: 'consent',
      consentSummary: '  Authorizes treatment; signed and dated. ',
      confidence: 0.9,
    }),
    {
      documentClass: 'consent',
      consentSummary: 'Authorizes treatment; signed and dated.',
      confidence: 0.9,
    }
  )
  for (const consentSummary of [null, '', '  ']) {
    assert.throws(
      () =>
        validateClassification({
          documentClass: 'consent',
          consentSummary,
          confidence: 0.9,
        }),
      { message: 'Consent classification requires a summary' }
    )
  }
})

test('drops summaries returned for clinical and other documents', () => {
  for (const documentClass of ['clinical', 'other'] as const) {
    assert.equal(
      validateClassification({
        documentClass,
        consentSummary: 'Unexpected',
        confidence: 0.8,
      }).consentSummary,
      null
    )
  }
})

test('rejects unknown classes and out-of-range confidence without echoing content', () => {
  for (const output of [
    { documentClass: 'invoice', consentSummary: null, confidence: 0.5 },
    { documentClass: 'other', consentSummary: null, confidence: 1.5 },
    { documentClass: 'other', consentSummary: 'PRIVATE SENTINEL' },
  ]) {
    assert.throws(() => validateClassification(output), {
      message: 'Invalid classification schema',
    })
  }
})

test('builds a data-only prompt with text blocks of every page', () => {
  assert.deepEqual(JSON.parse(buildDocumentPrompt([ocr, ocr])), {
    pages: [
      {
        page: 1,
        blocks: [
          { id: 'p1-b1', kind: 'paragraph', text: 'I authorize treatment.' },
        ],
      },
      {
        page: 2,
        blocks: [
          { id: 'p1-b1', kind: 'paragraph', text: 'I authorize treatment.' },
        ],
      },
    ],
  })
})

test('classifies a document without text as other without a model call', async (context) => {
  const call = context.mock.method(models.fast, 'doGenerate', modelOutput({}))
  assert.deepEqual(
    await classifyDocument([{ blocks: [], usage: { latencyMs: 0 } }]),
    { documentClass: 'other', consentSummary: null, confidence: 1 }
  )
  assert.equal(call.mock.callCount(), 0)
})

test('returns the validated class from one structured model call', async (context) => {
  const call = context.mock.method(
    models.fast,
    'doGenerate',
    modelOutput({
      documentClass: 'consent',
      consentSummary: 'Authorizes treatment; signed.',
      confidence: 0.95,
    })
  )
  assert.equal((await classifyDocument([ocr])).documentClass, 'consent')
  assert.equal(call.mock.callCount(), 1)
})

test('sanitizes provider and schema failures', async (context) => {
  context.mock.method(models.fast, 'doGenerate', async () => {
    throw new Error('PRIVATE SENTINEL')
  })
  await assert.rejects(classifyDocument([ocr]), {
    message: 'Document classification failed',
  })

  context.mock.method(
    models.fast,
    'doGenerate',
    modelOutput({ documentClass: 'PRIVATE SENTINEL' })
  )
  await assert.rejects(classifyDocument([ocr]), {
    message: 'Document classification failed',
  })
})
