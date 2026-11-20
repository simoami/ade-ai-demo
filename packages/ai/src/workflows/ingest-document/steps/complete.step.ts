import { logger } from '@repo/logger'
import { completeDocument } from '#workflows/ingest-document/processing'

/** Records the terminal document status outside workflow replay. */
export async function complete(
  documentId: string,
  status: 'reviewed' | 'discarded',
  refreshCount: number
) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.complete' })

  await completeDocument(documentId, status)

  const result = { documentId, status, refreshCount }
  log.info(result, 'Document workflow completed')

  return result
}
