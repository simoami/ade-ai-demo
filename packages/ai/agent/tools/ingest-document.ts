import { defineWorkflowTool } from 'eve/tools'
import { z } from 'zod'
import { ingestDocument } from '../../src/workflows/ingest-document/ingest-document.workflow'
import { documentIdSchema } from '../../src/workflows/ingest-document/review-action'

export default defineWorkflowTool({
  description: 'Render a synthetic document and wait for review decisions.',
  inputSchema: z.strictObject({ documentId: documentIdSchema }),
  execute: ingestDocument,
})
