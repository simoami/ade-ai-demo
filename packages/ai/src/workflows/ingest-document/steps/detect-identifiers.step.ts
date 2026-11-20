import { logger } from '@repo/logger'
import { detectDocumentIdentifiers } from '#workflows/ingest-document/analyze-document'

/** Detects identifier spans and stores them encrypted; only their count enters workflow history. */
export async function detectIdentifiers(documentId: string) {
  'use step'
  const log = logger.getSubLogger({
    name: 'ingest-document.detect-identifiers',
  })

  const started = performance.now()
  const result = await detectDocumentIdentifiers(documentId)
  log.info(
    {
      documentId,
      ...result,
      durationMs: Math.round(performance.now() - started),
    },
    'Identifier detection completed'
  )
  return result
}
