import { notFound } from 'next/navigation'
import { getPatients, getReviewDocument } from '#lib/server/records'
import { DocumentReviewClient } from './document-review-client.tsx'

/** Review screen for one processed document. */
export async function DocumentReview({ params }: PageProps<'/documents/[id]'>) {
  const document = await getReviewDocument((await params).id)
  if (!document) notFound()

  return (
    <DocumentReviewClient
      key={document.id}
      signedAt={document.pageUrlsSignedAt}
      document={document}
      patients={await getPatients()}
    />
  )
}
