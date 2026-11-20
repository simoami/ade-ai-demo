import type { DocumentStatus } from './records-types.ts'

/** Only completed, immutable documents may enter the server cache. */
export function isTerminalDocument(status: DocumentStatus) {
  return (
    status === 'reviewed' || status === 'discarded' || status === 'unsupported'
  )
}

/** Shared list tags invalidate terminal artifacts and patient profiles after writes. */
export const recordTags = {
  documents: 'documents',
  patients: 'patients',
  document: (id: string) => `document:${id}`,
  patient: (id: string) => `patient:${id}`,
}
