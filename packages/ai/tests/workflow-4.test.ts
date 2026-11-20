import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { documents, observations } from '@repo/db'
import type { ExtractedObservation } from '#stages/extract/extract-observations'
import type { OcrPage } from '#stages/ocr/ocr-result'
import type { IdentifierSpan } from '#stages/redact/redaction-types'
import {
  classifyStoredDocument,
  detectDocumentIdentifiers,
  identifyDocumentPatient,
  proposePatient,
} from '#workflows/ingest-document/analyze-document'
import {
  decryptArtifact,
  encryptArtifact,
} from '#workflows/ingest-document/artifact-encryption'
import { finishProcessing } from '#workflows/ingest-document/extract-document'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'
const key = Buffer.alloc(32, 7)
const hashKey = Buffer.alloc(32, 1).toString('base64')
const secretText = 'Synthetic Alvarez 1957-03-14 MRN-55821'
const pages: OcrPage[] = [
  {
    blocks: [
      {
        id: 'header',
        kind: 'paragraph',
        text: secretText,
        box: { x: 0.1, y: 0.1, width: 0.4, height: 0.05 },
        continues: null,
      },
      {
        id: 'labs',
        kind: 'table',
        text: 'Hemoglobin 13.2 g/dL',
        box: { x: 0.1, y: 0.5, width: 0.4, height: 0.1 },
        continues: null,
      },
    ],
    usage: { latencyMs: 1 },
  },
]
const spans: IdentifierSpan[] = [
  {
    page: 1,
    blockId: 'header',
    start: 0,
    end: 18,
    category: 'name',
    confidence: 0.9,
  },
]

type Update = typeof documents.$inferInsert

function harness() {
  const blobs = new Map<string, Buffer>([
    [
      `documents/${documentId}/ocr.json.enc`,
      encryptArtifact(Buffer.from(JSON.stringify(pages)), key),
    ],
  ])
  const updates: Partial<Update>[] = []
  return {
    blobs,
    updates,
    deps: {
      storage: {
        get: async (path: string) => {
          const bytes = blobs.get(path)
          return bytes
            ? {
                stream: new ReadableStream<Uint8Array>({
                  start(controller) {
                    controller.enqueue(bytes)
                    controller.close()
                  },
                }),
                contentType: 'application/octet-stream',
              }
            : null
        },
        put: async (
          path: string,
          body: unknown,
          options: { contentType: string }
        ) => {
          assert.ok(Buffer.isBuffer(body))
          blobs.set(path, body)
          return {
            url: '',
            downloadUrl: '',
            pathname: path,
            contentType: options.contentType,
            contentDisposition: '',
            etag: '',
          }
        },
      },
      key: () => key,
      hashKey: () => hashKey,
      update: async (_id: string, values: Partial<Update>) => {
        updates.push(values)
      },
    },
  }
}

function assertNoContent(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const fragment of ['Alvarez', '1957', 'MRN-55821', 'Hemoglobin'])
    assert.ok(!serialized.includes(fragment))
}

test('persists the class and keeps a consent summary only for consent documents', async () => {
  for (const documentClass of ['consent', 'clinical'] as const) {
    const h = harness()
    const result = await classifyStoredDocument(documentId, {
      ...h.deps,
      classify: async (ocr) => {
        assert.deepEqual(ocr, pages)
        return {
          documentClass,
          consentSummary: 'Agrees to synthetic treatment',
          confidence: 0.9,
        }
      },
    })
    assert.deepEqual(result, { documentClass, confidence: 0.9 })
    assert.deepEqual(h.updates, [
      {
        documentClass,
        consentSummary:
          documentClass === 'consent' ? 'Agrees to synthetic treatment' : null,
      },
    ])
  }
})

test('hashes identifiers inside the step, links a partial match with a mismatch and returns only the strength', async () => {
  const h = harness()
  const result = await identifyDocumentPatient(documentId, {
    ...h.deps,
    now: () => new Date('2026-11-20T00:00:00Z'),
    readDemographics: async () => ({
      firstName: 'Synthetic',
      lastName: 'Alvarez',
      birthDate: '1957-03-14',
      mrn: 'MRN-55821',
      sex: 'Female',
    }),
    findPatients: async (hashes) => {
      assert.deepEqual(Object.keys(hashes).sort(), [
        'birthDate',
        'firstName',
        'lastName',
        'mrn',
      ])
      assertNoContent(hashes)
      return [
        {
          id: 'PT-1',
          lastNameHash: hashes.lastName ?? null,
          firstNameHash: null,
          birthDateHash: null,
          mrnHash: null,
          sex: 'Female',
        },
      ]
    },
  })
  assert.deepEqual(result, { strength: 'partial' })
  const [update] = h.updates
  assert.equal(update?.patientId, 'PT-1')
  assert.equal(update?.identityMismatch, true)
  assert.equal(update?.sex, 'Female')
  assert.deepEqual(update?.proposedPatient, {
    initials: 'SA',
    birthYear: 1957,
    sex: 'Female',
  })
  assertNoContent(update?.identifierHashes)
})

test('records no link and no mismatch when no patient shares an identifier', async () => {
  const h = harness()
  assert.deepEqual(
    await identifyDocumentPatient(documentId, {
      ...h.deps,
      readDemographics: async () => ({ sex: 'Unknown' }),
      findPatients: async () => [],
    }),
    { strength: 'none' }
  )
  assert.deepEqual(h.updates, [
    {
      identifierHashes: {},
      sex: 'Unknown',
      patientId: null,
      identityMismatch: false,
      proposedPatient: null,
    },
  ])
})

test('omits the birth year from a proposed patient aged 90 or over', () => {
  const now = new Date('2026-11-20T00:00:00Z')
  assert.equal(
    proposePatient({ lastName: 'Old', birthDate: '1936-11-20' }, now)
      ?.birthYear,
    null
  )
  assert.equal(
    proposePatient({ lastName: 'Old', birthDate: '1936-11-21' }, now)
      ?.birthYear,
    1936
  )
  assert.deepEqual(proposePatient({ lastName: 'only' }, now), {
    initials: 'O',
    birthYear: null,
    sex: 'Unknown',
  })
})

test('hides stage failures from classification and matching errors', async () => {
  const h = harness()
  const leak = async () => {
    throw new Error(secretText)
  }
  await assert.rejects(
    classifyStoredDocument(documentId, { ...h.deps, classify: leak }),
    { message: 'Document classification failed' }
  )
  await assert.rejects(
    identifyDocumentPatient(documentId, { ...h.deps, readDemographics: leak }),
    { message: 'Document patient matching failed' }
  )
  assert.deepEqual(h.updates, [])
})

test('stores detected spans encrypted and reuses them on retry without another model call', async () => {
  const h = harness()
  let calls = 0
  const detect = async () => {
    calls++
    return spans
  }
  assert.deepEqual(
    await detectDocumentIdentifiers(documentId, { ...h.deps, detect }),
    { spanCount: 1 }
  )
  assert.deepEqual(
    await detectDocumentIdentifiers(documentId, { ...h.deps, detect }),
    { spanCount: 1 }
  )
  assert.equal(calls, 1)
  const stored = h.blobs.get(`documents/${documentId}/identifiers.json.enc`)
  assert.ok(stored)
  assert.deepEqual(JSON.parse(decryptArtifact(stored, key).toString()), spans)
})

function observation(
  values: Partial<ExtractedObservation> = {}
): ExtractedObservation {
  return {
    page: 1,
    blockId: 'labs',
    kind: 'lab',
    name: 'Hemoglobin',
    value: '13.2',
    valueNumeric: 13.2,
    unit: 'g/dL',
    effectiveDate: '2026-11-01',
    dateSource: 'explicit',
    sourceFormat: 'table',
    details: { referenceRange: '12-16' },
    confidence: 0.9,
    ...values,
  }
}

function extraction(extracted: ExtractedObservation[]) {
  const h = harness()
  h.blobs.set(
    `documents/${documentId}/identifiers.json.enc`,
    encryptArtifact(Buffer.from(JSON.stringify(spans)), key)
  )
  const replaced: (typeof observations.$inferInsert)[][] = []
  return {
    ...h,
    replaced,
    overrides: {
      ...h.deps,
      extract: async (ocr: OcrPage[], masked: unknown) => {
        assert.deepEqual(ocr, pages)
        assert.deepEqual(masked, spans)
        return extracted
      },
      redactions: async () => [
        {
          id: 'covering',
          page: 1,
          box: { x: 0.1, y: 0.5, width: 0.2, height: 0.1 },
          state: 'applied' as const,
        },
        {
          id: 'rejected',
          page: 1,
          box: { x: 0.1, y: 0.5, width: 0.4, height: 0.1 },
          state: 'rejected' as const,
        },
        {
          id: 'small',
          page: 1,
          box: { x: 0.1, y: 0.5, width: 0.04, height: 0.1 },
          state: 'needsReview' as const,
        },
      ],
      replace: async (
        _id: string,
        rows: (typeof observations.$inferInsert)[]
      ) => {
        replaced.push(rows)
      },
    },
  }
}

test('extracts clinical documents with masked spans, flags low confidence and records covering redactions', async () => {
  const h = extraction([
    observation(),
    observation({
      name: 'WBC',
      value: 'high',
      valueNumeric: null,
      confidence: 0.5,
    }),
    observation({ effectiveDate: null, dateSource: null, name: 'Fatigue' }),
    observation({ effectiveDate: null, dateSource: null, name: 'Fatigue' }),
  ])
  const result = await finishProcessing(documentId, 'clinical', h.overrides)
  assert.deepEqual(result, {
    status: 'needsReview',
    observationCount: 3,
    flaggedCount: 1,
    removedCount: 3,
  })
  assertNoContent(result)
  assert.deepEqual(
    h.updates.map((update) => update.status),
    ['extracting', 'needsReview']
  )
  const rows = h.replaced[0] ?? []
  assert.deepEqual(
    rows.map((row) => [row.name, row.valueNumeric, row.reviewStatus]),
    [
      ['Hemoglobin', '13.2', 'unchecked'],
      ['WBC', null, 'flagged'],
      ['Fatigue', '13.2', 'unchecked'],
    ]
  )
  assert.deepEqual(rows[0]?.source, [
    { page: 1, blockId: 'labs', box: pages[0]?.blocks[1]?.box },
  ])
  assert.deepEqual(rows[0]?.removedByRedactionIds, ['covering'])
  for (const row of rows)
    assert.match(
      row.id,
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
    )
})

test('replaces identical observation rows when extraction is retried', async () => {
  const h = extraction([observation()])
  await finishProcessing(documentId, 'clinical', h.overrides)
  await finishProcessing(documentId, 'clinical', h.overrides)
  assert.deepEqual(h.replaced[0], h.replaced[1])
})

test('opens review for consent and marks other documents unsupported without extraction', async () => {
  for (const [documentClass, status] of [
    ['consent', 'needsReview'],
    ['other', 'unsupported'],
  ] as const) {
    const h = extraction([])
    const result = await finishProcessing(documentId, documentClass, {
      ...h.overrides,
      extract: async () => assert.fail('extraction must not run'),
    })
    assert.equal(result.status, status)
    assert.deepEqual(h.updates, [{ status }])
    assert.deepEqual(h.replaced, [])
  }
})

test('rejects observations citing unknown blocks without persisting or leaking content', async () => {
  const h = extraction([observation({ blockId: 'missing' })])
  await assert.rejects(finishProcessing(documentId, 'clinical', h.overrides), {
    message: 'Document extraction failed',
  })
  assert.deepEqual(h.replaced, [])
  assert.ok(!h.updates.some((update) => update.status === 'needsReview'))
})
