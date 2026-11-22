import { createHook, FatalError } from 'eve/workflow'
import { classifyPages } from '#workflows/ingest-document/steps/classify-pages.step'
import { cleanupArtifacts } from '#workflows/ingest-document/steps/cleanup-artifacts.step'
import { detectIdentifiers } from '#workflows/ingest-document/steps/detect-identifiers.step'
import { fail } from '#workflows/ingest-document/steps/fail.step'
import { finish } from '#workflows/ingest-document/steps/finish-processing.step'
import { identifyPatient } from '#workflows/ingest-document/steps/identify-patient.step'
import { readPages } from '#workflows/ingest-document/steps/read-pages.step'
import { redactPages } from '#workflows/ingest-document/steps/redact-pages.step'
import { renderPages } from '#workflows/ingest-document/steps/render-pages.step'
import { review } from '#workflows/ingest-document/steps/review.step'
import type { IngestInput } from './processing.ts'
import { type ReviewAction, reviewToken } from './review-action'

/** Renders, transcribes, classifies, links, redacts and extracts uploaded originals, then applies review decisions until review or discard. */
export async function ingestDocument(input: IngestInput) {
  'use workflow'

  const { documentId } = input

  let terminal = false

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

      if (action.type === 'markReviewed' || action.type === 'discard') {
        terminal = true
        await cleanupArtifacts(documentId, input.pathnames)

        return {
          documentId,
          status:
            action.type === 'discard'
              ? ('discarded' as const)
              : ('reviewed' as const),
          refreshCount,
        }
      }
    }

    throw new FatalError('Review hook ended without a terminal action')
  } catch {
    if (!terminal) await fail(documentId)
    throw new FatalError('Document ingestion failed')
  }
}
