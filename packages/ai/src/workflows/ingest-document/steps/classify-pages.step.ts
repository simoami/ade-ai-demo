import { logger } from '@repo/logger'
import { classifyStoredDocument } from '#workflows/ingest-document/analyze-document'

/** Classifies the document inside a durable step; only the class and confidence enter workflow history. */
export async function classifyPages(documentId: string) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.classify-pages' })

  const started = performance.now()
  const result = await classifyStoredDocument(documentId)
  log.info(
    {
      documentId,
      ...result,
      durationMs: Math.round(performance.now() - started),
    },
    'Classification completed'
  )
  return result
}
