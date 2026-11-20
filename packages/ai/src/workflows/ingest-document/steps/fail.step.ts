import { logger } from '@repo/logger'
import { updateDocument } from '#workflows/ingest-document/document-store'

/** Records an unrecoverable workflow failure without persisting its cause. */
export async function fail(documentId: string) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.fail' })

  await updateDocument(documentId, { status: 'failed' })
  log.info({ documentId, status: 'failed' }, 'Document workflow failed')
}
