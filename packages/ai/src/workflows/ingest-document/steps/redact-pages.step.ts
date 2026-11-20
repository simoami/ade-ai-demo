import { logger } from '@repo/logger'
import { redactDocument } from '#workflows/ingest-document/redact-document'

/** Detects, burns and publishes redactions without returning content to workflow history. */
export async function redactPages(documentId: string, pageCount: number) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.redact-pages' })

  const started = performance.now()
  const result = await redactDocument(documentId, pageCount)
  log.info(
    {
      documentId,
      ...result,
      status: 'needsReview',
      durationMs: Math.round(performance.now() - started),
    },
    'Redaction completed'
  )
  return result
}
