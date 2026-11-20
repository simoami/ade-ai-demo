import type { DocumentSummary } from './sample-records.ts'

/** Applies the document category or status filter and a case-insensitive search. */
export function filterDocuments(
  documents: DocumentSummary[],
  filter: 'All' | 'Needs review' | 'Clinical' | 'Consent',
  query: string
): DocumentSummary[] {
  const search = query.trim().toLowerCase()

  return documents.filter((document) => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Needs review'
        ? document.status === 'needsReview'
        : document.documentClass === filter.toLowerCase())

    return (
      matchesFilter &&
      `${document.fileName} ${document.id} ${document.patientId ?? ''}`
        .toLowerCase()
        .includes(search)
    )
  })
}
