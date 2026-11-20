import { logger } from '@repo/logger'
import { finishProcessing } from '#workflows/ingest-document/extract-document'

/** Branches by document class after redaction; only statuses and counts enter workflow history. */
export async function finish(
  documentId: string,
  documentClass: 'clinical' | 'consent' | 'other'
) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.finish' })

  const started = performance.now()
  const result = await finishProcessing(documentId, documentClass)
  log.info(
    {
      documentId,
      documentClass,
      ...result,
      durationMs: Math.round(performance.now() - started),
    },
    'Processing completed'
  )
  return result
}
