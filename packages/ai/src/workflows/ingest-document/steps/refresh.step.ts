import type { ReviewAction } from '#workflows/ingest-document/review-action'
import { log } from '#workflows/ingest-document/steps/log'

/** Records a review refresh without persisting document content. */
export async function refresh(
  documentId: string,
  _action: ReviewAction,
  refreshCount: number
) {
  'use step'

  // A recorded result proves each action crosses a durable step without storing content.
  const count = refreshCount + 1
  log.info({ documentId, refreshCount: count }, 'Refresh completed')

  return count
}
