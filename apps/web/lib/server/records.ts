import {
  asc,
  createDb,
  desc,
  documents,
  eq,
  observations,
  patients,
  redactions,
  sql,
} from '@repo/db'
import { cacheLife, cacheTag } from 'next/cache'
import { connection } from 'next/server'
import { cache } from 'react'
import { isTerminalDocument, recordTags } from '#lib/cache-policy'
import { observationState, patientFieldMatches } from '#lib/record-mapping'
import type {
  DocumentSummary,
  Observation,
  Patient,
  ReviewDocument,
} from '#lib/records-types'

import { documentPages } from '#lib/server/document-pages'

type DocumentRow = typeof documents.$inferSelect

type PatientRow = typeof patients.$inferSelect

type ObservationRow = typeof observations.$inferSelect

function patientSummary(row: PatientRow): Patient {
  return {
    id: row.id,
    initials: row.initials,
    sex: row.sex === 'Female' || row.sex === 'Male' ? row.sex : 'Unknown',
    birthYear: row.birthYear,
  }
}

function documentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    fileName: row.fileName,
    documentClass: row.documentClass,
    patientId: row.patientId,
    pages: row.pageDimensions.length,
    status: row.status,
    uploadedAt: row.createdAt.toISOString(),
  }
}

function observationSummary(row: ObservationRow): Observation {
  const source = row.source[0]
  if (!source) throw new Error('Observation source is missing')

  return {
    id: row.id,
    page: source.page,
    kind: row.kind,
    name: row.name,
    value: row.value,
    unit: row.unit ?? '',
    date: row.effectiveDate ?? '',
    box: source.box,
    state: observationState(row.reviewStatus),
  }
}

/** Lists documents with their linked patient's limited demographics, newest first. */
export const getDocuments = cache(async () => {
  await connection()

  const rows = await createDb()
    .select({ document: documents, patient: patients })
    .from(documents)
    .leftJoin(patients, eq(documents.patientId, patients.id))
    .orderBy(desc(documents.createdAt))
  return rows.map(({ document, patient }) => ({
    ...documentSummary(document),
    patient: patient ? patientSummary(patient) : null,
  }))
})

/** Lists patients with document counts without exposing identifier hashes. */
export async function getPatients() {
  await connection()

  const rows = await createDb()
    .select({
      patient: patients,
      documentCount: sql<number>`count(${documents.id})::int`,
    })
    .from(patients)
    .leftJoin(documents, eq(documents.patientId, patients.id))
    .groupBy(patients.id)
    .orderBy(asc(patients.id))
  return rows.map(({ patient, documentCount }) => ({
    ...patientSummary(patient),
    documentCount,
  }))
}

/** Loads a document's review artifacts and patient matches, excluding removed observations. */
export async function getReviewDocument(
  id: string
): Promise<(ReviewDocument & { pageUrlsSignedAt: number }) | undefined> {
  await connection()

  const db = createDb()
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)
  if (!row) return undefined

  const [{ redactionRows, observationRows }, patientRows] = await Promise.all([
    isTerminalDocument(row.status)
      ? terminalArtifacts(row)
      : readArtifacts(row.id),
    db.select().from(patients).orderBy(asc(patients.id)),
  ])
  return {
    ...documentSummary(row),
    ...(await documentPages(
      row.id,
      row.status,
      row.pageDimensions,
      row.pageVersion
    )),
    pageUrlsSignedAt: Date.now(),
    identityMismatch: row.identityMismatch,
    proposedPatient: row.proposedPatient,
    redactions: redactionRows.map(
      ({ id, page, category, box, points, state }) => ({
        id,
        page,
        category,
        box,
        points,
        state,
      })
    ),
    observations: observationRows
      .filter((observation) => observation.removedByRedactionIds.length === 0)
      .map(observationSummary),
    patientMatches: Object.fromEntries(
      patientRows.map((patient) => [
        patient.id,
        patientFieldMatches(
          { ...row.identifierHashes, sex: row.sex },
          {
            lastName: patient.lastNameHash,
            firstName: patient.firstNameHash,
            birthDate: patient.birthDateHash,
            mrn: patient.mrnHash,
            sex: patient.sex,
          }
        ),
      ])
    ),
  }
}

/** Loads one patient's documents and active observations for the patient profile. */
export async function getPatientRecord(id: string) {
  await connection()

  const db = createDb()
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, id))
    .limit(1)
  if (!patient) return undefined

  const linked = await db
    .select()
    .from(documents)
    .where(eq(documents.patientId, id))
    .orderBy(desc(documents.createdAt))

  // Live membership detects asynchronous pipeline writes before selecting a cache entry.
  if (linked.every((document) => isTerminalDocument(document.status))) {
    return terminalPatientRecord(patient, linked)
  }

  return patientRecord(patient, linked)
}

async function patientRecord(patient: PatientRow, linked: DocumentRow[]) {
  const facts = await createDb()
    .select({ observation: observations })
    .from(observations)
    .innerJoin(documents, eq(observations.documentId, documents.id))
    .where(eq(documents.patientId, patient.id))
    .orderBy(asc(observations.effectiveDate), asc(observations.id))

  return {
    patient: patientSummary(patient),
    documents: linked.map(documentSummary),
    observations: facts
      .filter(
        ({ observation }) =>
          observation.removedByRedactionIds.length === 0 &&
          observation.reviewStatus !== 'rejected'
      )
      .map(({ observation }) => observationSummary(observation)),
  }
}

async function readArtifacts(id: string) {
  const db = createDb()
  const [redactionRows, observationRows] = await Promise.all([
    db
      .select()
      .from(redactions)
      .where(eq(redactions.documentId, id))
      .orderBy(asc(redactions.page), asc(redactions.id)),
    db
      .select()
      .from(observations)
      .where(eq(observations.documentId, id))
      .orderBy(asc(observations.effectiveDate), asc(observations.id)),
  ])
  return { redactionRows, observationRows }
}

async function terminalArtifacts(row: DocumentRow) {
  'use cache'
  cacheLife('max')
  cacheTag(recordTags.documents, recordTags.document(row.id))
  if (row.patientId) cacheTag(recordTags.patient(row.patientId))
  return readArtifacts(row.id)
}

async function terminalPatientRecord(
  patient: PatientRow,
  linked: DocumentRow[]
) {
  'use cache'
  cacheLife('max')
  cacheTag(
    recordTags.patients,
    recordTags.patient(patient.id),
    recordTags.documents
  )
  return patientRecord(patient, linked)
}
