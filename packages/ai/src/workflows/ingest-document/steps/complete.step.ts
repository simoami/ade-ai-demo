import { logger } from '@repo/logger'

/** Records the terminal document status outside workflow replay. */
export async function complete(
  documentId: string,
  status: 'reviewed' | 'discarded',
  refreshCount: number
) {
  'use step'

  const result = { documentId, status, refreshCount }
  logger
    .getSubLogger({ name: 'pipeline' })
    .info(result, 'Document workflow completed')

  return result
}
