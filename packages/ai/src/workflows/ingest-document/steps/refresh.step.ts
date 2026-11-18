import { logger } from '@repo/logger'
import type { ReviewAction } from '#workflows/ingest-document/review-action'

/** Records a review refresh without persisting document content. */
export async function refresh(
  documentId: string,
  _action: ReviewAction,
  refreshCount: number
) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.refresh' })

  // A recorded result proves each action crosses a durable step without storing content.
  const count = refreshCount + 1
  log.info({ documentId, refreshCount: count }, 'Refresh completed')

  return count
}
