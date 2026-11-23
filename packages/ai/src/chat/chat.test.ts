import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { observations } from '@repo/db'
import { PgDialect } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import {
  chatInstructions,
  defaultScope,
  observationQuerySchema,
  pageContextSchema,
  TOOL_PRESENTATION_INSTRUCTIONS,
} from './context.ts'
import { observationFilters } from './queries.ts'
import { observationQueryResult } from './selection.ts'
import {
  chatTools,
  type ObservationView,
  observationTrendResult,
  observationViews,
} from './tools.ts'

test('validates page scopes and rejects incomplete or conflicting contexts', () => {
  for (const context of [
    { page: 'documents' },
    { page: 'patients' },
    { page: 'document', documentId: 'doc-1' },
    { page: 'patient', patientId: 'pt-1' },
  ]) {
    assert.equal(pageContextSchema.safeParse(context).success, true)
  }
  for (const context of [
    { page: 'unknown' },
    { page: 'document' },
    { page: 'patient', patientId: '' },
    { page: 'documents', documentId: 'doc-1' },
    { page: 'document', documentId: 'doc-1', patientId: 'pt-1' },
  ]) {
    assert.equal(pageContextSchema.safeParse(context).success, false)
  }
})

test('defaults tools to the open record and preserves an explicit requested scope', () => {
  assert.deepEqual(
    defaultScope({}, { page: 'document', documentId: 'doc-1' }),
    { documentId: 'doc-1', patientId: undefined }
  )
  assert.deepEqual(defaultScope({}, { page: 'patient', patientId: 'pt-1' }), {
    patientId: 'pt-1',
    documentId: undefined,
  })
  assert.deepEqual(
    defaultScope(
      { patientId: 'pt-2' },
      { page: 'document', documentId: 'doc-1' }
    ),
    { patientId: 'pt-2' }
  )
  assert.deepEqual(defaultScope({}, { page: 'patients' }), {
    patientId: undefined,
    documentId: undefined,
  })
})

test('validates every tool input before database or embedding access', () => {
  const tools = chatTools({ page: 'documents' })
  for (const [name, tool] of Object.entries(tools)) {
    assert.ok(tool.inputSchema instanceof z.ZodType)
    assert.equal(
      tool.inputSchema.safeParse({
        patientId: 12,
        documentId: false,
        name: '',
        query: '',
        status: 'invalid',
      }).success,
      false,
      name
    )
  }
  assert.equal(
    observationQuerySchema.safeParse({
      kind: 'medication',
      outOfRangeOnly: true,
    }).success,
    true
  )
  assert.equal(
    observationQuerySchema.safeParse({ kind: 'diagnosis' }).success,
    false
  )
  assert.equal(
    observationQuerySchema.safeParse({ name: 'x'.repeat(201) }).success,
    false
  )
})

test('parameterizes clinical filters and always excludes rejected or removed rows', () => {
  const query = observationFilters({
    patientId: 'pt-1',
    documentId: 'doc-1',
    kind: 'lab',
    name: "Glucose'; drop table observations; --",
    outOfRangeOnly: true,
  })
  assert.ok(query)
  const compiled = new PgDialect().sqlToQuery(query)
  assert.match(compiled.sql, /review_status.*<> 'rejected'/)
  assert.match(compiled.sql, /cardinality\(.*removed_by_redaction_ids.*\) = 0/)
  assert.match(compiled.sql, /flagNormalized.*'low', 'high', 'abnormal'/)
  assert.equal(compiled.sql.includes('drop table'), false)
  assert.deepEqual(compiled.params, [
    'doc-1',
    'pt-1',
    'lab',
    "Glucose'; drop table observations; --",
  ])
})

const row: typeof observations.$inferSelect = {
  id: 'obs-1',
  documentId: 'doc-1',
  kind: 'lab',
  name: 'Glucose',
  value: '110',
  valueNumeric: '110',
  unit: 'mg/dL',
  effectiveDate: '2026-01-02',
  dateSource: null,
  sourceFormat: 'table',
  source: [
    { page: 2, blockId: 'block-1', box: { x: 0, y: 0, width: 1, height: 1 } },
  ],
  reviewStatus: 'unchecked',
  details: {},
  removedByRedactionIds: [],
}

test('maps numeric values and unverified states with real source citations only', () => {
  assert.deepEqual(
    observationViews([row]).map((view) => ({
      value: view.valueNumeric,
      state: view.state,
      page: view.page,
      documentId: view.documentId,
    })),
    [{ value: 110, state: 'extracted', page: 2, documentId: 'doc-1' }]
  )
  assert.equal(
    observationViews([{ ...row, reviewStatus: 'flagged' }])[0]?.state,
    'needsReview'
  )
  assert.equal(
    observationViews([{ ...row, reviewStatus: 'corrected' }])[0]?.state,
    'accepted'
  )
  assert.deepEqual(
    observationViews([
      { ...row, source: [] },
      { ...row, reviewStatus: 'rejected' },
      { ...row, removedByRedactionIds: ['redaction-1'] },
    ]),
    []
  )
})

test('orders trends, excludes incompatible units and labels unverified points', () => {
  const view = observationViews([row])[0]
  assert.ok(view)
  const rows: ObservationView[] = [
    view,
    { ...view, date: '2026-01-01', valueNumeric: 95, state: 'accepted' },
    { ...view, unit: 'mmol/L', valueNumeric: 6 },
    { ...view, name: 'Other' },
    { ...view, date: '' },
    { ...view, valueNumeric: null },
  ]
  const result = observationTrendResult('Glucose', rows)
  assert.equal(result.unit, 'mg/dL')
  assert.deepEqual(
    result.points.map((point) => [point.date, point.value, point.flag]),
    [
      ['2026-01-01', 95, null],
      ['2026-01-02', 110, 'unverified'],
    ]
  )
  assert.deepEqual(observationTrendResult('Missing', rows).points, [])
})

test('instructions include the stable rule forbidding restating tool results', () => {
  assert.match(
    TOOL_PRESENTATION_INSTRUCTIONS,
    /Do not restate rows, values or tables already shown/
  )
  assert.match(TOOL_PRESENTATION_INSTRUCTIONS, /at most 1–3 short sentences/)
  assert.match(
    TOOL_PRESENTATION_INSTRUCTIONS,
    /never restate counts or mention truncation/
  )
  assert.ok(
    chatInstructions({ page: 'documents' }).includes(
      TOOL_PRESENTATION_INSTRUCTIONS
    )
  )
})

test('summarizes every matching observation before selecting the latest per kind and name', () => {
  const views = observationViews(
    Array.from({ length: 238 }, (_, index) => ({
      ...row,
      id: `obs-${index}`,
      effectiveDate: index === 237 ? '2026-02-01' : '2026-01-01',
      details: index < 2 ? { flagNormalized: 'high' as const } : {},
      reviewStatus: index < 3 ? ('unchecked' as const) : ('confirmed' as const),
    }))
  )
  const result = observationQueryResult(views)
  assert.deepEqual(result.summary, {
    total: 238,
    byKind: {
      lab: 238,
      vital: 0,
      'adverse-event': 0,
      'medical-history': 0,
      medication: 0,
      symptom: 0,
    },
    outOfRange: 2,
    unverified: 3,
  })
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0]?.id, 'obs-237')
  assert.equal(result.truncated, true)
})

test('prioritizes abnormal, then unverified, then clinical kind order and caps at 20', () => {
  const view = observationViews([row])[0]
  assert.ok(view)
  const rows: ObservationView[] = [
    ...Array.from({ length: 25 }, (_, index) => ({
      ...view,
      id: `lab-${index}`,
      name: `Test ${index}`,
      state: 'accepted' as const,
    })),
    {
      ...view,
      id: 'abnormal',
      name: 'Abnormal',
      details: { flagNormalized: 'high' },
      state: 'accepted',
    },
    { ...view, id: 'unverified', kind: 'symptom', name: 'Fatigue' },
    ...(
      [
        'vital',
        'adverse-event',
        'medical-history',
        'medication',
        'symptom',
      ] as const
    ).map((kind) => ({
      ...view,
      kind,
      id: kind,
      name: kind,
      state: 'accepted' as const,
    })),
  ]
  const result = observationQueryResult(rows)
  assert.equal(result.observations.length, 20)
  assert.deepEqual(
    result.observations.slice(0, 2).map((o) => o.id),
    ['abnormal', 'unverified']
  )
  const ordered = observationQueryResult(rows.slice(-5))
  assert.deepEqual(
    ordered.observations.map((o) => o.kind),
    ['vital', 'adverse-event', 'medical-history', 'medication', 'symptom']
  )
  assert.equal(result.truncated, true)
})

test('named queries retain the latest 20 repeated test results in chronological order', () => {
  const view = observationViews([row])[0]
  assert.ok(view)
  const rows = Array.from({ length: 25 }, (_, index) => ({
    ...view,
    id: `obs-${index}`,
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
  }))
  const result = observationQueryResult(rows, true)
  assert.equal(result.summary.total, 25)
  assert.equal(result.observations.length, 20)
  assert.equal(result.observations[0]?.date, '2026-01-06')
  assert.equal(result.observations.at(-1)?.date, '2026-01-25')
  assert.equal(result.truncated, true)
  assert.deepEqual(observationQueryResult([...rows].reverse(), true), result)
})

test('handles empty, undated and rejected observations deterministically without mutating input', () => {
  const empty = observationQueryResult([])
  assert.equal(empty.summary.total, 0)
  assert.deepEqual(empty.observations, [])
  assert.equal(empty.truncated, false)
  const view = observationViews([row])[0]
  assert.ok(view)
  const rows: ObservationView[] = [
    { ...view, id: 'z', date: '' },
    { ...view, id: 'a', date: '' },
    { ...view, state: 'rejected' },
  ]
  const result = observationQueryResult(rows)
  assert.equal(result.summary.total, 2)
  assert.equal(result.observations[0]?.id, 'a')
  assert.equal(rows[0]?.id, 'z')
})

test('note answers synthesize retrieved evidence with page links instead of chunk dumps', () => {
  const instructions = chatInstructions({
    page: 'document',
    documentId: 'synthetic-document',
  })

  assert.match(instructions, /synthesize the retrieved text in 1–4 sentences/)
  assert.ok(instructions.includes('[page N](/documents/<documentId>?page=N)'))
  assert.match(instructions, /Never paste chunks/)
})
