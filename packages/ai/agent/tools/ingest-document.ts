import { defineWorkflowTool } from 'eve/tools'
import { ingestDocument } from '#workflows/ingest-document/ingest-document.workflow'
import {
  documentIdSchema,
  startDocumentSchema,
} from '#workflows/ingest-document/review-action'

/** Registers the document ingestion workflow as an agent tool. */
export default defineWorkflowTool({
  description:
    'Render and transcribe uploaded documents, then wait for review decisions.',
  inputSchema: startDocumentSchema.extend({ documentId: documentIdSchema }),
  execute: ingestDocument,
})
