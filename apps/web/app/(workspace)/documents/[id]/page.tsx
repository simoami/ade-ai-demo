import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ReviewSkeleton } from '#components/record-skeletons'
import { DocumentReviewClient } from '#components/review/document-review-client'
import { getPatients, getReviewDocument } from '#lib/server/records'

/** Review screen for one processed document. */
async function DocumentReview({ params }: PageProps<'/documents/[id]'>) {
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

/** Streams document artifacts without blocking the workspace shell. */
export default function DocumentReviewPage(
  props: PageProps<'/documents/[id]'>
) {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <DocumentReview {...props} />
    </Suspense>
  )
}
