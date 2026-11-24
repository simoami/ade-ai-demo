import { Suspense } from 'react'
import { ReviewSkeleton } from '#components/record-skeletons/review-skeleton'
import { DocumentReview } from '#components/review/document-review'

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
