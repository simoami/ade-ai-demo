import { getDocuments } from '#lib/server/records'

/** Number of documents waiting for review. */
export async function ReviewCount() {
  return (await getDocuments()).filter(
    (document) => document.status === 'needsReview'
  ).length
}
