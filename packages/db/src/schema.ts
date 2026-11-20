import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core'

/** Normalized top-left rectangle in page coordinates. */
export type Box = { x: number; y: number; width: number; height: number }

/** Keyed HMAC-SHA256 identifier values; raw identifiers never enter database rows. */
export type IdentifierHashes = Partial<
  Record<'lastName' | 'firstName' | 'birthDate' | 'mrn', string>
>

/** Non-identifying demographics for creating a patient; birth year is null at age 90 or over. */
export type ProposedPatient = {
  initials: string
  birthYear: number | null
  sex: 'Female' | 'Male' | 'Unknown'
}

/** One source region, using a one-based page number and the OCR block ID. */
export type SourceRegion = { page: number; blockId: string; box: Box }

/** Kind-specific details are validated by the extraction boundary before persistence. */
export type ObservationDetails = {
  referenceRange?: string
  flag?: string
  startDate?: string
  endDate?: string
  seriousness?: string
}

export const documentStatus = pgEnum('document_status', [
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

export const documentClass = pgEnum('document_class', [
  'clinical',
  'consent',
  'other',
])

export const redactionState = pgEnum('redaction_state', [
  'applied',
  'needsReview',
  'accepted',
  'rejected',
])

export const observationKind = pgEnum('observation_kind', [
  'lab',
  'vital',
  'symptom',
  'adverse-event',
])

export const observationReviewStatus = pgEnum('observation_review_status', [
  'confirmed',
  'corrected',
  'rejected',
  'flagged',
  'unchecked',
])

export const reviewAction = pgEnum('review_action', [
  'redaction.update',
  'observation.resolve',
  'observation.update',
  'patient.link',
  'patient.create',
  'discard',
  'markReviewed',
])

/** Only keyed identifier hashes and limited demographics identify a patient. */
export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  mrnHash: text('mrn_hash'),
  firstNameHash: text('first_name_hash'),
  lastNameHash: text('last_name_hash'),
  birthDateHash: text('birth_date_hash'),
  initials: text('initials').notNull(),
  sex: text('sex').notNull(),
  birthYear: integer('birth_year'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/** One uploaded document; OCR remains in Blob rather than database rows. */
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').references(() => patients.id),
    status: documentStatus('status').default('rendering').notNull(),
    fileName: text('file_name').notNull(),
    originalPathname: text('original_pathname').notNull(),
    documentClass: documentClass('document_class'),
    sex: text('sex'),
    identifierHashes: jsonb('identifier_hashes').$type<IdentifierHashes>(),
    identityMismatch: boolean('identity_mismatch').default(false).notNull(),
    proposedPatient: jsonb('proposed_patient').$type<ProposedPatient>(),
    pageVersion: integer('page_version'),
    pageDimensions: jsonb('page_dimensions')
      .$type<{ width: number; height: number }[]>()
      .default([])
      .notNull(),
    runId: text('run_id'),
    consentSummary: text('consent_summary'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [index('documents_patient_id_idx').on(table.patientId)]
)

/** Pipeline rows use caller-supplied deterministic IDs to support replay-safe upserts. */
export const redactions = pgTable(
  'redactions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    blockId: text('block_id'),
    box: jsonb('box').$type<Box>().notNull(),
    points: jsonb('points').$type<[number, number][]>().notNull(),
    category: text('category').notNull(),
    state: redactionState('state').notNull(),
  },
  (table) => [index('redactions_document_id_idx').on(table.documentId)]
)

/** Clinical facts remain document-scoped; removal records every covering redaction. */
export const observations = pgTable(
  'observations',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    kind: observationKind('kind').notNull(),
    name: text('name').notNull(),
    value: text('value').notNull(),
    valueNumeric: numeric('value_numeric'),
    unit: text('unit'),
    effectiveDate: date('effective_date'),
    dateSource: text('date_source'),
    sourceFormat: text('source_format', {
      enum: ['table', 'list', 'narrative'],
    }).notNull(),
    source: jsonb('source').$type<SourceRegion[]>().notNull(),
    reviewStatus: observationReviewStatus('review_status')
      .default('unchecked')
      .notNull(),
    details: jsonb('details').$type<ObservationDetails>().default({}).notNull(),
    removedByRedactionIds: text('removed_by_redaction_ids')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
  },
  (table) => [index('observations_document_id_idx').on(table.documentId)]
)

/** Redacted note chunks and their source regions support cosine similarity search. */
export const noteChunks = pgTable(
  'note_chunks',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    source: jsonb('source').$type<SourceRegion[]>().notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    removedByRedactionIds: text('removed_by_redaction_ids')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
  },
  (table) => [
    index('note_chunks_document_id_idx').on(table.documentId),
    index('note_chunks_embedding_cosine_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  ]
)

/** Enrichment belongs to its note chunk and disappears from reads when that chunk is removed. */
export const clinicalEntities = pgTable('clinical_entities', {
  id: text('id').primaryKey(),
  noteChunkId: text('note_chunk_id')
    .notNull()
    .references(() => noteChunks.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  category: text('category').notNull(),
  type: text('type').notNull(),
  assertions: jsonb('assertions')
    .$type<{ name: string; score: number }[]>()
    .notNull(),
  codes: jsonb('codes')
    .$type<
      { system: string; code: string; description: string; score: number }[]
    >()
    .notNull(),
})

/** Human actions are append-only by convention and retained when derived data is discarded. */
export const reviewEvents = pgTable(
  'review_events',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id),
    action: reviewAction('action').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('review_events_document_id_idx').on(table.documentId)]
)

/** Each eve chat session has exactly one patient or document context. */
export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id').references(() => patients.id),
    documentId: text('document_id').references(() => documents.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'chat_sessions_one_context',
      sql`num_nonnulls(${table.patientId}, ${table.documentId}) = 1`
    ),
  ]
)
