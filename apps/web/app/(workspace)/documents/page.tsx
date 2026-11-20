import { DocumentsList } from '#components/documents-list'
import { getDocuments } from '#lib/server/records'

/** Document operations and upload entry point. */
export default async function DocumentsPage() {
  return <DocumentsList documents={await getDocuments()} />
}
