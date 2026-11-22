import assert from 'node:assert/strict'
import { test } from 'node:test'
import { models } from '#models'
import type { OcrPage } from '#stages/ocr/ocr-result'
import {
  detectIdentifiers,
  reviewPictures,
  validateIdentifierOutput,
  validatePictureOutput,
} from '#stages/pii/detect-identifiers'
import {
  buildPagePrompt,
  identifierPrompt,
  picturePrompt,
} from '#stages/pii/prompt'

const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const ocr: OcrPage = {
  blocks: [
    {
      id: 'p1-b1',
      kind: 'paragraph',
      text: 'DOB: 1978-04-12\nName: Synthetic Person',
      box,
      continues: null,
    },
    {
      id: 'p1-b2',
      kind: 'figure',
      text: 'PRIVATE FIGURE',
      box,
      continues: null,
    },
  ],
  usage: { latencyMs: 0 },
}

const span = {
  blockId: 'p1-b1',
  start: 10,
  end: 15,
  category: 'dob',
  confidence: 0.9,
}

const finding = {
  blockId: 'p1-b2',
  kind: 'patientPhoto',
  decision: 'redact',
  confidence: 0.9,
  identifiers: [],
}

test('validates DOB partial-token offsets and preserves year and page identity', () => {
  const result = validateIdentifierOutput({ spans: [span] }, ocr, 3)
  assert.equal(ocr.blocks[0]?.text.slice(span.start, span.end), '04-12')
  assert.deepEqual(result, [{ ...span, page: 3 }])
})

test('rejects missing blocks, figures, reversed, empty, whitespace and out-of-range spans', () => {
  for (const invalid of [
    { blockId: 'missing' },
    { blockId: 'p1-b2' },
    { start: 15 },
    { start: 16 },
    { start: 4, end: 5 },
    { end: 500 },
    { start: -1 },
    { start: 1.5 },
  ]) {
    assert.throws(
      () =>
        validateIdentifierOutput({ spans: [{ ...span, ...invalid }] }, ocr, 1),
      /Invalid identifier/
    )
  }
})

test('rejects schemas without disclosing model content', () => {
  for (const output of [
    { spans: [{ ...span, category: 'PRIVATE SENTINEL' }] },
    { spans: [{ ...span, confidence: 2 }] },
    null,
  ])
    assert.throws(() => validateIdentifierOutput(output, ocr, 1), {
      message: 'Invalid identifier schema',
    })
  assert.throws(
    () =>
      validatePictureOutput(
        { findings: [{ ...finding, kind: 'PRIVATE SENTINEL' }] },
        ocr,
        1
      ),
    { message: 'Invalid picture schema' }
  )
})

test('requires complete unique picture findings and mandatory redaction decisions', () => {
  assert.deepEqual(validatePictureOutput({ findings: [finding] }, ocr, 2), [
    { ...finding, page: 2 },
  ])
  for (const findings of [
    [],
    [finding, finding],
    [{ ...finding, blockId: 'p1-b1' }],
    [{ ...finding, decision: 'keep' }],
    [{ ...finding, kind: 'signature', decision: 'review' }],
    [{ ...finding, kind: 'logo', decision: 'redact' }],
    [{ ...finding, kind: 'face', decision: 'redact' }],
  ])
    assert.throws(() => validatePictureOutput({ findings }, ocr, 1))
})

test('accepts kept pictures with embedded identifiers and rejects escaped boxes', () => {
  const kept = {
    ...finding,
    kind: 'medicalImage',
    decision: 'keep',
    identifiers: [
      { category: 'name', box: { x: 0.2, y: 0.2, width: 0.2, height: 0.1 } },
    ],
  }
  assert.equal(
    validatePictureOutput({ findings: [kept] }, ocr, 1)[0]?.identifiers.length,
    1
  )
  assert.throws(
    () =>
      validatePictureOutput(
        {
          findings: [
            {
              ...kept,
              identifiers: [{ category: 'name', box: { ...box, x: 0.9 } }],
            },
          ],
        },
        ocr,
        1
      ),
    /Invalid picture identifier box/
  )
})

test('builds data-only prompts and includes figure context only for pictures', () => {
  const text = JSON.parse(buildPagePrompt(2, ocr))
  assert.equal(text.pageNumber, 2)
  assert.equal(text.blocks.length, 1)
  assert.equal(text.blocks[0].text, ocr.blocks[0]?.text)
  assert.equal(JSON.parse(buildPagePrompt(1, ocr, true)).blocks.length, 2)
  assert.match(identifierPrompt, /1978-04-12/)
  assert.match(identifierPrompt, /provider names/)
  assert.match(identifierPrompt, /UTF-16/)
  assert.match(picturePrompt, /owner is unclear/)
  assert.match(picturePrompt, /Every handwritten signature/)
})

test('skips model calls for empty text and pages without figures', async () => {
  assert.deepEqual(await detectIdentifiers([]), [])
  assert.deepEqual(
    await detectIdentifiers([{ blocks: [], usage: { latencyMs: 0 } }]),
    []
  )
  assert.deepEqual(
    await reviewPictures({
      pageNumber: 1,
      image: new Uint8Array(),
      ocr: { ...ocr, blocks: [] },
    }),
    []
  )
})

test('sanitizes provider failures for identifier and picture calls', async (context) => {
  context.mock.method(models.pipeline, 'doGenerate', async () => {
    throw new Error('PRIVATE SENTINEL')
  })
  await assert.rejects(detectIdentifiers([ocr]), {
    message: 'Identifier detection failed on page 1',
  })
  await assert.rejects(
    reviewPictures({ pageNumber: 2, image: new Uint8Array([1]), ocr }),
    { message: 'Picture review failed on page 2' }
  )
})

test('retains low-confidence spans so geometry can flag them for review', () => {
  assert.equal(
    validateIdentifierOutput(
      { spans: [{ ...span, confidence: 0.5 }] },
      ocr,
      1
    )[0]?.confidence,
    0.5
  )
})

test('detects identifiers in page order with one call per nonempty page', async (context) => {
  let calls = 0
  context.mock.method(models.pipeline, 'doGenerate', async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          spans: [{ ...span, blockId: `p${++calls}-b1` }],
        }),
      },
    ],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  }))
  const second: OcrPage = {
    ...ocr,
    blocks: ocr.blocks.map((block) => ({
      ...block,
      id: block.id.replace('p1-', 'p2-'),
    })),
  }
  const result = await detectIdentifiers([ocr, second])
  assert.equal(calls, 2)
  assert.deepEqual(
    result.map(({ page, blockId }) => ({ page, blockId })),
    [
      { page: 1, blockId: 'p1-b1' },
      { page: 2, blockId: 'p2-b1' },
    ]
  )
})

test('returns validated picture decisions from structured model output', async (context) => {
  const generate = context.mock.method(
    models.pipeline,
    'doGenerate',
    async () => ({
      content: [
        { type: 'text', text: JSON.stringify({ findings: [finding] }) },
      ],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    })
  )
  assert.deepEqual(
    await reviewPictures({ pageNumber: 2, image: new Uint8Array([1]), ocr }),
    [{ ...finding, page: 2 }]
  )
  assert.equal(generate.mock.callCount(), 1)
})

test('drops contained spans regardless of category or model order', () => {
  const outer = { ...span, start: 5, end: 15 }
  const inner = { ...span, start: 10, end: 11, category: 'phone' }
  for (const spans of [
    [inner, outer],
    [outer, inner],
    [outer, outer],
  ])
    assert.deepEqual(validateIdentifierOutput({ spans }, ocr, 1), [
      { ...outer, page: 1 },
    ])
})

test('merges overlapping spans using the longest original span category', () => {
  const spans = [
    { ...span, start: 5, end: 11, category: 'name' },
    { ...span, start: 10, end: 20, category: 'phone' },
    { ...span, start: 19, end: 30, category: 'address' },
  ]
  assert.deepEqual(validateIdentifierOutput({ spans }, ocr, 2), [
    { ...spans[2], start: 5, page: 2 },
  ])
})

test('keeps adjacent spans and overlapping offsets in separate blocks', () => {
  const spans = [{ ...span, start: 5, end: 10 }, span]
  assert.deepEqual(
    validateIdentifierOutput({ spans }, ocr, 1),
    spans.map((span) => ({ ...span, page: 1 }))
  )
  const secondBlock = { ...span, blockId: 'p1-b3' }
  const pages = {
    ...ocr,
    blocks: [
      ...ocr.blocks,
      ...ocr.blocks
        .filter((block) => block.kind !== 'figure')
        .map((block) => ({ ...block, id: 'p1-b3' })),
    ],
  }
  assert.equal(
    validateIdentifierOutput({ spans: [span, secondBlock] }, pages, 1).length,
    2
  )
})
