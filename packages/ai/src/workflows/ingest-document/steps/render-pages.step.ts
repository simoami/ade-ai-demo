import { logger } from '@repo/logger'
import { FatalError } from 'eve/workflow'
import {
  type IngestInput,
  renderDocument,
} from '#workflows/ingest-document/processing'

/** Renders originals into internal Blob PNGs; failures never expose document content. */
export async function renderPages(input: IngestInput) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.render-pages' })

  const started = performance.now()
  try {
    const result = await renderDocument(input)
    log.info(
      {
        documentId: input.documentId,
        pageCount: result.pageCount,
        durationMs: Math.round(performance.now() - started),
      },
      'Render completed'
    )
    return result
  } catch {
    throw new FatalError('Document rendering failed')
  }
}
