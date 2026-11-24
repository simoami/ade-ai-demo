import { DocumentStats } from '#components/document-stats'
import { getDocuments } from '#lib/server/records'

/** Document statistics computed from the current document list. */
export async function CurrentDocumentStats() {
  return <DocumentStats documents={await getDocuments()} />
}
