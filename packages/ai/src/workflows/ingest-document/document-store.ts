import {
  createDb,
  documents,
  eq,
  type IdentifierHashes,
  observations,
  or,
  patients,
  redactions,
} from '@repo/db'

type DocumentUpdate = Pick<
  typeof documents.$inferInsert,
  | 'pageVersion'
  | 'status'
  | 'pageDimensions'
  | 'runId'
  | 'reviewedAt'
  | 'documentClass'
  | 'consentSummary'
  | 'patientId'
  | 'identityMismatch'
  | 'identifierHashes'
  | 'sex'
  | 'proposedPatient'
>

/** Reads a persisted document and its workflow association. */
export async function findDocument(documentId: string) {
  return createDb().query.documents.findFirst({
    where: (table, { eq }) => eq(table.id, documentId),
  })
}

/** Creates the document before its workflow can begin. */
export async function insertDocument(input: {
  documentId: string
  fileName: string
  pathnames: string[]
}) {
  const originalPathname = input.pathnames[0]
  if (!originalPathname) throw new Error('Document has no originals')

  await createDb().insert(documents).values({
    id: input.documentId,
    fileName: input.fileName,
    originalPathname,
    status: 'rendering',
  })
}

/** Persists pipeline milestones and verifies the document still exists. */
export async function updateDocument(
  documentId: string,
  values: DocumentUpdate
) {
  const rows = await createDb()
    .update(documents)
    .set(values)
    .where(eq(documents.id, documentId))
    .returning({ id: documents.id })
  if (rows.length !== 1) throw new Error('Document not found')
}

/** Atomically replaces one document's redactions so retries cannot duplicate rows. */
export async function replaceRedactions(
  documentId: string,
  rows: (typeof redactions.$inferInsert)[]
) {
  const db = createDb()
  const remove = db
    .delete(redactions)
    .where(eq(redactions.documentId, documentId))
  if (rows.length) {
    await db.batch([remove, db.insert(redactions).values(rows)])
  } else {
    await remove
  }
}

/** Atomically replaces one document's observations so retries cannot duplicate rows. */
export async function replaceObservations(
  documentId: string,
  rows: (typeof observations.$inferInsert)[]
) {
  const db = createDb()
  const remove = db
    .delete(observations)
    .where(eq(observations.documentId, documentId))
  if (rows.length) {
    await db.batch([remove, db.insert(observations).values(rows)])
  } else {
    await remove
  }
}

/** Lists the regions of one document's redactions for observation overlap. */
export async function listRedactions(documentId: string) {
  return createDb()
    .select({
      id: redactions.id,
      page: redactions.page,
      box: redactions.box,
      state: redactions.state,
    })
    .from(redactions)
    .where(eq(redactions.documentId, documentId))
}

/** Lists patients sharing at least one identifier hash with a document. */
export async function findPatientCandidates(hashes: IdentifierHashes) {
  const columns = {
    mrn: patients.mrnHash,
    firstName: patients.firstNameHash,
    lastName: patients.lastNameHash,
    birthDate: patients.birthDateHash,
  } as const
  const matches = Object.entries(hashes).flatMap(([field, hash]) =>
    hash ? [eq(columns[field as keyof IdentifierHashes], hash)] : []
  )
  if (!matches.length) return []

  return createDb()
    .select({
      id: patients.id,
      mrnHash: patients.mrnHash,
      firstNameHash: patients.firstNameHash,
      lastNameHash: patients.lastNameHash,
      birthDateHash: patients.birthDateHash,
      sex: patients.sex,
    })
    .from(patients)
    .where(or(...matches))
}
