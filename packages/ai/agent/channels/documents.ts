import { randomUUID } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { defineChannel, GET, POST } from 'eve/channels'
import { getRun, resumeHook, start } from 'eve/workflow/api'
import {
  artifactDirectory,
  readRunId,
  saveRun,
} from '../../src/local-artifacts'
import { ingestDocument } from '../../src/workflows/ingest-document/ingest-document.workflow'
import {
  documentIdSchema,
  reviewActionSchema,
  reviewToken,
  startDocumentSchema,
} from '../../src/workflows/ingest-document/review-action'
import { authenticatePipeline } from '../lib/pipeline-auth'

function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function authenticated(
  request: Request,
  action: () => Promise<Response>
) {
  try {
    const auth = await authenticatePipeline(request)

    if (auth instanceof Response) return auth

    return await action()
  } catch (error) {
    // Messages may carry document content, so only the error type is logged.
    console.error('Pipeline request failed', {
      error: error instanceof Error ? error.name : typeof error,
    })
    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }
}

export default defineChannel({
  routes: [
    POST('/pipeline/documents', async (request) =>
      authenticated(request, async () => {
        const parsed = startDocumentSchema.safeParse(
          await request.json().catch(() => null)
        )

        if (!parsed.success)
          return Response.json(
            { error: 'Invalid fixture request' },
            { status: 400 }
          )

        const documentId = randomUUID()
        const directory = artifactDirectory(documentId)
        await mkdir(directory, { recursive: true, mode: 0o700 })
        await copyFile(
          resolve('../../fixtures/synthetic/clinical-20.pdf'),
          join(directory, 'original.pdf')
        )

        const run = await start(ingestDocument, [{ documentId }])

        try {
          await saveRun(documentId, run.runId)
        } catch (error) {
          await run.cancel()

          throw error
        }

        return Response.json({ documentId, runId: run.runId }, { status: 202 })
      })
    ),
    GET('/pipeline/documents/:id', async (request, { params }) =>
      authenticated(request, async () => {
        const id = documentIdSchema.safeParse(params.id)

        if (!id.success)
          return Response.json(
            { error: 'Invalid document ID' },
            { status: 400 }
          )

        let runId: string

        try {
          runId = await readRunId(id.data)
        } catch (error) {
          if (missing(error))
            return Response.json(
              { error: 'Document not found' },
              { status: 404 }
            )

          throw error
        }

        const run = getRun(runId)
        const status = await run.status

        return Response.json({
          documentId: id.data,
          runId,
          status,
          ...(status === 'completed' ? { result: await run.returnValue } : {}),
        })
      })
    ),
    POST('/pipeline/documents/:id/review', async (request, { params }) =>
      authenticated(request, async () => {
        const id = documentIdSchema.safeParse(params.id)
        const action = reviewActionSchema.safeParse(
          await request.json().catch(() => null)
        )

        if (!id.success || !action.success)
          return Response.json(
            { error: 'Invalid review action' },
            { status: 400 }
          )

        try {
          await resumeHook(reviewToken(id.data), action.data)
        } catch (error) {
          // The hook may not exist yet, or may have been disposed after review.
          if (error instanceof Error && error.name === 'HookNotFoundError')
            return Response.json(
              { error: 'Review hook is unavailable' },
              { status: 409 }
            )

          throw error
        }

        return Response.json({ accepted: true }, { status: 202 })
      })
    ),
  ],
})
