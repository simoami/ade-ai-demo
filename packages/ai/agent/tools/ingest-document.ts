import { defineWorkflowTool } from 'eve/tools'
import { ingestDocument } from '#workflows/ingest-document/ingest-document.workflow'
import {
  documentIdSchema,
  startDocumentSchema,
} from '#workflows/ingest-document/review-action'

/** Registers the document ingestion workflow as an agent tool. */
export default defineWorkflowTool({
  description:
    'Render, transcribe, classify, link, redact and extract uploaded documents, then apply review decisions.',
  inputSchema: startDocumentSchema.extend({ documentId: documentIdSchema }),
  execute: ingestDocument,
})
