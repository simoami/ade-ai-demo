import { logger } from '@repo/logger'
import { identifyDocumentPatient } from '#workflows/ingest-document/analyze-document'

/** Reads, hashes and matches identifiers inside a durable step; only the match strength enters workflow history. */
export async function identifyPatient(documentId: string) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.identify-patient' })

  const started = performance.now()
  const result = await identifyDocumentPatient(documentId)
  log.info(
    {
      documentId,
      ...result,
      durationMs: Math.round(performance.now() - started),
    },
    'Patient matching completed'
  )
  return result
}
