import { logger } from '@repo/logger'
import { cleanupDocumentArtifacts } from '#workflows/ingest-document/artifact-cleanup'

/** Deletes transient artifacts after the terminal review status has been persisted. */
export async function cleanupArtifacts(
  documentId: string,
  pathnames: string[]
) {
  'use step'
  const log = logger.getSubLogger({ name: 'ingest-document.cleanup-artifacts' })

  const deleted = await cleanupDocumentArtifacts(documentId, pathnames)

  log.info({ documentId, deleted }, 'Document artifacts cleaned')
}
