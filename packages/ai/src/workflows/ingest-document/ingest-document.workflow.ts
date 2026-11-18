import { createHook, FatalError } from 'eve/workflow'
import { type ReviewAction, reviewToken } from './review-action'
import { refresh } from './steps/refresh.step'
import { renderPages } from './steps/render-pages.step'

export async function ingestDocument({ documentId }: { documentId: string }) {
  'use workflow'

  await renderPages(documentId)

  using hook = createHook<ReviewAction>({ token: reviewToken(documentId) })
  if (await hook.getConflict())
    throw new FatalError('Document already has a review run')

  let refreshCount = 0
  for await (const action of hook) {
    if (action.type === 'markReviewed' || action.type === 'discard') {
      return {
        documentId,
        status: action.type === 'discard' ? 'discarded' : 'reviewed',
        refreshCount,
      }
    }

    refreshCount = await refresh(documentId, action, refreshCount)
  }

  throw new FatalError('Review hook ended without a terminal action')
}
