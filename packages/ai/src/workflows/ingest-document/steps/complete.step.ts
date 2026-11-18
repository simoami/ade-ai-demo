import { log } from '#workflows/ingest-document/steps/log'

/** Records the terminal document status outside workflow replay. */
export async function complete(
  documentId: string,
  status: 'reviewed' | 'discarded',
  refreshCount: number
) {
  'use step'

  const result = { documentId, status, refreshCount }
  log.info(result, 'Document workflow completed')

  return result
}
