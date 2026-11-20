import { logger } from '@repo/logger'
import type { ReviewAction } from '#workflows/ingest-document/review-action'
import { applyReviewAction } from '#workflows/ingest-document/review-actions'

/** Applies one persisted review decision; a refusal leaves the document unchanged and the loop waiting. */
export async function review(documentId: string, action: ReviewAction) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.review' })

  const result = await applyReviewAction(documentId, action)
  log.info(
    { documentId, actionType: action.type, ...result },
    'refusal' in result ? 'Review action refused' : 'Review action applied'
  )
  return result
}
