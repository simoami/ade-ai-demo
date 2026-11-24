import type { PageContext } from '@repo/ai/chat'

/** A document as the assistant names it: enough to link and label, nothing clinical. */
export type DocumentRef = { id: string; fileName: string }

/**
 * Derives the assistant's default tool scope from the workspace route.
 * "/patients/p-1" → { page: 'patient', patientId: 'p-1' }; "/patients" → { page: 'patients' }.
 */
export function pageContext(pathname: string, id?: string): PageContext {
  if (id && pathname.startsWith('/patients/'))
    return { page: 'patient', patientId: id }
  if (id && pathname.startsWith('/documents/'))
    return { page: 'document', documentId: id }

  return { page: pathname.startsWith('/patients') ? 'patients' : 'documents' }
}

/** Names the scope for the assistant header, preferring a document's file name over its ID. */
export function pageScopeLabel(
  context: PageContext,
  documents: DocumentRef[]
): string {
  switch (context.page) {
    case 'document':
      return `Document · ${documents.find((document) => document.id === context.documentId)?.fileName ?? context.documentId}`
    case 'patient':
      return `Patient · ${context.patientId}`
    case 'patients':
      return 'All patients'
    case 'documents':
      return 'All documents'
  }
}
