import { createDb, documents, eq, redactions } from '@repo/db'

type DocumentUpdate = Pick<
  typeof documents.$inferInsert,
  'pageVersion' | 'status' | 'pageDimensions' | 'runId' | 'reviewedAt'
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
