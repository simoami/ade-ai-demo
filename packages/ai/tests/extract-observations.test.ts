import assert from 'node:assert/strict'
import { test } from 'node:test'
import { models } from '#models'
import { dedupeObservations } from '#stages/extract/dedupe-observations'
import {
  extractObservations,
  validateObservationOutput,
} from '#stages/extract/extract-observations'
import { maskIdentifiers } from '#stages/extract/mask-identifiers'
import { buildExtractionPrompt } from '#stages/extract/prompt'
import type { OcrPage } from '#stages/ocr/ocr-result'

const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const page: OcrPage = {
  blocks: [
    {
      id: 'p1-b1',
      kind: 'header',
      text: 'Patient: Synthetic Person  DOB 1978-04-12',
      box,
      continues: null,
    },
    {
      id: 'p1-b2',
      kind: 'table',
      text: 'Glucose 133 mg/dL 70-99 H',
      box,
      continues: null,
    },
    {
      id: 'p1-b3',
      kind: 'figure',
      text: 'PRIVATE FIGURE',
      box,
      continues: null,
    },
  ],
  words: [{ text: 'Synthetic', box }],
  usage: { latencyMs: 0 },
}

const observation = {
  blockId: 'p1-b2',
  kind: 'lab',
  name: 'Glucose',
  value: '133',
  unit: 'mg/dL',
  effectiveDate: '2026-02-10',
  dateSource: 'document',
  sourceFormat: 'table',
  details: {
    referenceRange: '70-99',
    flag: 'H',
    startDate: null,
    endDate: null,
    seriousness: null,
  },
  confidence: 0.9,
}

test('replaces identifier spans, merges overlaps and drops figures and words', () => {
  const [masked] = maskIdentifiers(
    [page],
    [
      { page: 1, blockId: 'p1-b1', start: 9, end: 18 },
      { page: 1, blockId: 'p1-b1', start: 14, end: 25 },
      { page: 1, blockId: 'p1-b1', start: 36, end: 41 },
    ]
  )
  assert.deepEqual(
    masked?.blocks.map((block) => block.text),
    ['Patient: [REDACTED]  DOB 1978-[REDACTED]', 'Glucose 133 mg/dL 70-99 H']
  )
  assert.equal(masked?.words, undefined)
  assert.doesNotMatch(
    buildExtractionPrompt(1, masked ?? page),
    /Synthetic|04-12|PRIVATE/
  )
})

test('rejects masked spans that cannot be applied', () => {
  for (const span of [
    { page: 2, blockId: 'p1-b1', start: 0, end: 1 },
    { page: 1, blockId: 'missing', start: 0, end: 1 },
    { page: 1, blockId: 'p1-b3', start: 0, end: 1 },
    { page: 1, blockId: 'p1-b1', start: 5, end: 5 },
    { page: 1, blockId: 'p1-b1', start: 0, end: 500 },
  ])
    assert.throws(() => maskIdentifiers([page], [span]), {
      message: 'Invalid masked span',
    })
})

test('validates output, parses numeric values and drops null details', () => {
  const [result] = validateObservationOutput(
    {
      observations: [
        observation,
        {
          ...observation,
          kind: 'vital',
          name: 'Blood pressure',
          value: '128/82',
        },
      ],
    },
    page,
    3
  ).map(({ page, valueNumeric, details }) => ({ page, valueNumeric, details }))
  assert.deepEqual(result, {
    page: 3,
    valueNumeric: 133,
    details: { referenceRange: '70-99', flag: 'H' },
  })
  assert.equal(
    validateObservationOutput(
      { observations: [{ ...observation, value: '128/82' }] },
      page,
      1
    )[0]?.valueNumeric,
    null
  )
})

test('rejects invalid output without disclosing model content', () => {
  for (const [invalid, message] of [
    [{ kind: 'PRIVATE SENTINEL' }, 'Invalid observation schema'],
    [{ confidence: 2 }, 'Invalid observation schema'],
    [{ effectiveDate: '02/10/2026' }, 'Invalid observation schema'],
    [{ name: ' ' }, 'Invalid observation schema'],
    [{ blockId: 'p1-b3' }, 'Invalid observation block'],
    [{ blockId: 'missing' }, 'Invalid observation block'],
    [{ dateSource: null }, 'Invalid observation date source'],
    [{ effectiveDate: null }, 'Invalid observation date source'],
  ] as const)
    assert.throws(
      () =>
        validateObservationOutput(
          { observations: [{ ...observation, ...invalid }] },
          page,
          1
        ),
      { message }
    )
  assert.throws(() => validateObservationOutput(null, page, 1), {
    message: 'Invalid observation schema',
  })
})

test('keeps one observation per name and date, preferring table over list over narrative', () => {
  const item = (
    id: string,
    name: string,
    effectiveDate: string | null,
    sourceFormat: 'table' | 'list' | 'narrative'
  ) => ({ id, name, effectiveDate, sourceFormat })
  const kept = dedupeObservations([
    item('narrative', 'Glucose', '2026-02-10', 'narrative'),
    item('list', 'glucose ', '2026-02-10', 'list'),
    item('table', 'Glucose', '2026-02-10', 'table'),
    item('later-table', 'Glucose', '2026-02-10', 'table'),
    item('other-date', 'Glucose', '2026-02-11', 'narrative'),
    item('first-tie', 'Nausea', '2026-02-01', 'narrative'),
    item('second-tie', 'Nausea', '2026-02-01', 'narrative'),
    item('undated', 'Fatigue', null, 'list'),
    item('undated-again', 'Fatigue', null, 'narrative'),
  ])
  assert.deepEqual(
    kept.map(({ id }) => id),
    ['table', 'other-date', 'first-tie', 'undated', 'undated-again']
  )
})

test('masks text before the model call and deduplicates across pages', async (context) => {
  const prompts: string[] = []
  context.mock.method(
    models.pipeline,
    'doGenerate',
    async (options: unknown) => {
      prompts.push(JSON.stringify(options))
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ observations: [observation] }),
          },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }
    }
  )
  const result = await extractObservations(
    [
      page,
      { ...page, blocks: page.blocks.slice(1) },
      { blocks: [], usage: { latencyMs: 0 } },
    ],
    [{ page: 1, blockId: 'p1-b1', start: 9, end: 25 }]
  )
  assert.equal(prompts.length, 2)
  assert.doesNotMatch(prompts.join(''), /Synthetic Person|PRIVATE FIGURE/)
  assert.deepEqual(
    result.map(({ page, name }) => ({ page, name })),
    [{ page: 1, name: 'Glucose' }]
  )
})

test('sanitizes provider failures', async (context) => {
  context.mock.method(models.pipeline, 'doGenerate', async () => {
    throw new Error('PRIVATE SENTINEL')
  })
  await assert.rejects(extractObservations([page], []), {
    message: 'Observation extraction failed on page 1',
  })
})
