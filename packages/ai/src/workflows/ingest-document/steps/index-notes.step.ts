import { logger } from '@repo/logger'
import { indexDocumentNotes } from '#workflows/ingest-document/index-notes'

/** Indexes masked notes after redaction and before review opens, recording only counts and timing. */
export async function indexNotes(documentId: string) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.index-notes' })

  const started = performance.now()
  const result = await indexDocumentNotes(documentId)
  log.info(
    {
      documentId,
      ...result,
      durationMs: Math.round(performance.now() - started),
    },
    'Note indexing completed'
  )

  return result
}
