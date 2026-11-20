import { logger } from '@repo/logger'
import { FatalError } from 'eve/workflow'
import { readDocument } from '#workflows/ingest-document/processing'

/** Runs Reducto OCR and encrypts its output entirely inside a durable step. */
export async function readPages(documentId: string, pageCount: number) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.read-pages' })

  const started = performance.now()
  try {
    const result = await readDocument(documentId, pageCount)
    log.info(
      {
        documentId,
        pageCount: result.pageCount,
        durationMs: Math.round(performance.now() - started),
      },
      'OCR completed'
    )
    return result
  } catch {
    throw new FatalError('Document reading failed')
  }
}
