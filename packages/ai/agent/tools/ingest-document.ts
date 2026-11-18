import { defineWorkflowTool } from 'eve/tools'
import { z } from 'zod'
import { ingestDocument } from '#workflows/ingest-document/ingest-document.workflow'
import { documentIdSchema } from '#workflows/ingest-document/review-action'

/** Registers the document ingestion workflow as an agent tool. */
export default defineWorkflowTool({
  description: 'Render a synthetic document and wait for review decisions.',
  inputSchema: z.strictObject({ documentId: documentIdSchema }),
  execute: ingestDocument,
})
