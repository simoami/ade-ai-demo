import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getTableConfig } from 'drizzle-orm/pg-core'
import {
  chatSessions,
  clinicalEntities,
  documentStatus,
  documents,
  noteChunks,
  observations,
  patients,
  redactionState,
  redactions,
  reviewEvents,
} from '#schema'

test('defines exactly the eight application tables with caller-supplied replay-safe IDs', () => {
  const tables = [
    patients,
    documents,
    redactions,
    observations,
    noteChunks,
    clinicalEntities,
    reviewEvents,
    chatSessions,
  ]

  assert.deepEqual(tables.map((table) => getTableConfig(table).name).sort(), [
    'chat_sessions',
    'clinical_entities',
    'documents',
    'note_chunks',
    'observations',
    'patients',
    'redactions',
    'review_events',
  ])

  for (const table of tables) {
    assert.equal(table.id.primary, true)
    assert.equal(table.id.hasDefault, false)
  }
})

test('preserves the domain document statuses and redaction states', () => {
  assert.deepEqual(documentStatus.enumValues, [
    'rendering',
    'reading',
    'redacting',
    'extracting',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
    'failed',
  ])
  assert.deepEqual(redactionState.enumValues, [
    'applied',
    'needsReview',
    'accepted',
    'rejected',
  ])
})

test('stores only keyed identifiers and limited patient demographics', () => {
  assert.deepEqual(
    getTableConfig(patients).columns.map((column) => column.name),
    [
      'id',
      'mrn_hash',
      'first_name_hash',
      'last_name_hash',
      'birth_date_hash',
      'initials',
      'sex',
      'birth_year',
      'created_at',
    ]
  )
  assert.equal(patients.birthYear.notNull, false)
})

test('generates the vector extension before the vector column and HNSW cosine index', () => {
  const sql = readFileSync(
    new URL('../migrations/0000_initial.sql', import.meta.url),
    'utf8'
  )

  assert.ok(sql.startsWith('CREATE EXTENSION IF NOT EXISTS vector;'))
  assert.match(sql, /"embedding" vector\(1536\) NOT NULL/)
  assert.match(sql, /USING hnsw \("embedding" vector_cosine_ops\)/)
  assert.equal((sql.match(/CREATE TABLE /g) ?? []).length, 8)
})

test('retains review events while cascading deletion of document-derived data', () => {
  assert.equal(
    getTableConfig(reviewEvents).foreignKeys[0]?.onDelete,
    'no action'
  )

  for (const table of [
    redactions,
    observations,
    noteChunks,
    clinicalEntities,
  ]) {
    assert.equal(getTableConfig(table).foreignKeys[0]?.onDelete, 'cascade')
  }

  assert.equal(getTableConfig(chatSessions).checks.length, 1)
})

test('requires document filenames and Blob pathnames while deriving page count from dimensions', () => {
  assert.equal(documents.fileName.notNull, true)
  assert.equal(documents.originalPathname.notNull, true)
  assert.equal(documents.status.default, 'rendering')
  assert.equal(
    getTableConfig(documents).columns.some(
      (column) => column.name === 'page_count'
    ),
    false
  )
})

test('allows reviewer-drawn redactions without an OCR block', () => {
  assert.equal(redactions.blockId.notNull, false)
  const redaction: typeof redactions.$inferInsert = {
    id: 'manual-redaction',
    documentId: 'document',
    page: 1,
    blockId: null,
    box: { x: 0, y: 0, width: 0.1, height: 0.1 },
    points: [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
    ],
    category: 'name',
    state: 'accepted',
  }

  assert.equal(redaction.blockId, null)
})

test('indexes document and patient lookups with btree indexes', () => {
  const sql = readFileSync(
    new URL('../migrations/0000_initial.sql', import.meta.url),
    'utf8'
  )

  for (const table of [
    'redactions',
    'observations',
    'note_chunks',
    'review_events',
  ]) {
    assert.ok(
      sql.includes(
        `CREATE INDEX "${table}_document_id_idx" ON "${table}" USING btree ("document_id")`
      )
    )
  }

  assert.ok(
    sql.includes(
      'CREATE INDEX "documents_patient_id_idx" ON "documents" USING btree ("patient_id")'
    )
  )
})

test('stores nullable keyed document identifiers and plaintext limited sex demographics in migration 0001', () => {
  assert.equal(documents.identifierHashes.notNull, false)
  assert.equal(documents.sex.notNull, false)
  assert.equal(documents.identifierHashes.dataType, 'json')
  const sql = readFileSync(
    new URL('../migrations/0001_tricky_ghost_rider.sql', import.meta.url),
    'utf8'
  )
  assert.match(
    sql,
    /ALTER TABLE "documents" ADD COLUMN "identifier_hashes" jsonb;/
  )
  assert.match(sql, /ALTER TABLE "documents" ADD COLUMN "sex" text;/)
  assert.doesNotMatch(sql, /NOT NULL|DROP|CREATE TABLE/)
})
