import { notFound } from 'next/navigation'
import { ReviewWorkspace } from '#components/review/review-workspace'
import { findReviewDocument, patients } from '#lib/sample-records'

/** Review screen for one processed document. */
export default async function DocumentReviewPage({
  params,
}: PageProps<'/documents/[id]'>) {
  const document = findReviewDocument((await params).id)
  if (!document) notFound()

  return <ReviewWorkspace document={document} patients={patients} />
}
