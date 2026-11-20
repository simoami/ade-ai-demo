import { notFound } from 'next/navigation'
import { ReviewWorkspace } from '#components/review/review-workspace'
import { getPatients, getReviewDocument } from '#lib/server/records'

/** Review screen for one processed document. */
export default async function DocumentReviewPage({
  params,
}: PageProps<'/documents/[id]'>) {
  const document = await getReviewDocument((await params).id)
  if (!document) notFound()

  return (
    <ReviewWorkspace
      key={`${document.id}:${document.status}`}
      document={document}
      patients={await getPatients()}
    />
  )
}
