import { createHook, FatalError } from 'eve/workflow'
import type { IngestInput } from './processing.ts'
import { type ReviewAction, reviewToken } from './review-action'
import { complete } from './steps/complete.step'
import { fail } from './steps/fail.step'
import { readPages } from './steps/read-pages.step'
import { refresh } from './steps/refresh.step'
import { renderPages } from './steps/render-pages.step'

/** Renders and transcribes uploaded originals, then waits for review decisions until review or discard. */
export async function ingestDocument(input: IngestInput) {
  'use workflow'

  const { documentId } = input
  try {
    const { pageCount } = await renderPages(input)
    await readPages(documentId, pageCount)

    using hook = createHook<ReviewAction>({ token: reviewToken(documentId) })
    if (await hook.getConflict()) {
      throw new FatalError('Document already has a review run')
    }

    let refreshCount = 0
    for await (const action of hook) {
      if (action.type === 'markReviewed' || action.type === 'discard') {
        return await complete(
          documentId,
          action.type === 'discard' ? 'discarded' : 'reviewed',
          refreshCount
        )
      }

      refreshCount = await refresh(documentId, action, refreshCount)
    }

    throw new FatalError('Review hook ended without a terminal action')
  } catch {
    await fail(documentId)
    throw new FatalError('Document ingestion failed')
  }
}
