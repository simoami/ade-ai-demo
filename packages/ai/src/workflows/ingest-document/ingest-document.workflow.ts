import { createHook, FatalError } from 'eve/workflow'
import type { IngestInput } from './processing.ts'
import { type ReviewAction, reviewToken } from './review-action'
import { classifyPages } from './steps/classify-pages.step'
import { detectIdentifiers } from './steps/detect-identifiers.step'
import { fail } from './steps/fail.step'
import { finish } from './steps/finish-processing.step'
import { identifyPatient } from './steps/identify-patient.step'
import { readPages } from './steps/read-pages.step'
import { redactPages } from './steps/redact-pages.step'
import { renderPages } from './steps/render-pages.step'
import { review } from './steps/review.step'

/** Renders, transcribes, classifies, links, redacts and extracts uploaded originals, then applies review decisions until review or discard. */
export async function ingestDocument(input: IngestInput) {
  'use workflow'

  const { documentId } = input
  try {
    const { pageCount } = await renderPages(input)
    await readPages(documentId, pageCount)
    const [{ documentClass }] = await Promise.all([
      classifyPages(documentId),
      identifyPatient(documentId),
      detectIdentifiers(documentId),
    ])
    await redactPages(documentId, pageCount)
    await finish(documentId, documentClass)

    using hook = createHook<ReviewAction>({ token: reviewToken(documentId) })
    if (await hook.getConflict()) {
      throw new FatalError('Document already has a review run')
    }

    let refreshCount = 0
    for await (const action of hook) {
      const result = await review(documentId, action)
      if ('refusal' in result) continue
      if (result.applied) refreshCount++

      if (action.type === 'markReviewed' || action.type === 'discard')
        return {
          documentId,
          status:
            action.type === 'discard'
              ? ('discarded' as const)
              : ('reviewed' as const),
          refreshCount,
        }
    }

    throw new FatalError('Review hook ended without a terminal action')
  } catch {
    await fail(documentId)
    throw new FatalError('Document ingestion failed')
  }
}
