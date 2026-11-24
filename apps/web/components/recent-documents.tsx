import { DocumentRow } from '#components/document-row'
import { DocumentsList } from '#components/documents-list'
import { ProcessingRefresh } from '#components/processing-refresh'
import { reviewMode } from '#lib/review'
import { getDocuments } from '#lib/server/records'

/** Document table with server-rendered rows, refreshing while any document is processing. */
export async function RecentDocuments() {
  const documents = await getDocuments()
  return (
    <>
      <ProcessingRefresh
        path="/documents"
        active={documents.some(
          (document) => reviewMode(document.status) === 'processing'
        )}
      />
      <DocumentsList
        documents={documents}
        renderedRows={Object.fromEntries(
          documents.map((document) => [
            document.id,
            <DocumentRow key={document.id} document={document} />,
          ])
        )}
      />
    </>
  )
}
