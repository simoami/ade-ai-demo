import { randomUUID } from 'node:crypto'
import { logger } from '@repo/logger'
import { defineChannel, GET, POST } from 'eve/channels'
import { getRun, resumeHook, start } from 'eve/workflow/api'
import { authenticatePipeline } from '#agent/lib/pipeline-auth'
import {
  findDocument,
  insertDocument,
  updateDocument,
} from '#workflows/ingest-document/document-store'
import { ingestDocument } from '#workflows/ingest-document/ingest-document.workflow'
import {
  documentIdSchema,
  reviewActionSchema,
  reviewToken,
  startDocumentSchema,
} from '#workflows/ingest-document/review-action'
import { checkReviewAction } from '#workflows/ingest-document/review-actions'

const log = logger.getSubLogger({ name: 'documents' })

async function authenticated(
  request: Request,
  path: string,
  action: () => Promise<Response>
) {
  try {
    const auth = await authenticatePipeline(request)

    if (auth instanceof Response) {
      log.warn({ status: auth.status }, 'Pipeline authentication rejected')

      return auth
    }

    return await action()
  } catch (error) {
    // Messages may carry document content, so only the error type is logged.
    log.error(
      {
        path,
        status: 503,
        errorType: error instanceof Error ? error.name : typeof error,
      },
      'Pipeline request failed'
    )

    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }
}

/** Exposes authenticated document start, status and review routes. */
export default defineChannel({
  routes: [
    POST('/pipeline/documents', async (request) =>
      authenticated(request, '/pipeline/documents', async () => {
        const parsed = startDocumentSchema.safeParse(
          await request.json().catch(() => null)
        )

        if (!parsed.success)
          return Response.json(
            { error: 'Invalid document request' },
            { status: 400 }
          )

        const documentId = randomUUID()
        await insertDocument({ documentId, ...parsed.data })

        try {
          const run = await start(ingestDocument, [
            { documentId, ...parsed.data },
          ])
          try {
            await updateDocument(documentId, { runId: run.runId })
          } catch (error) {
            await run.cancel()
            throw error
          }

          log.info({ documentId, runId: run.runId }, 'Document run started')
          return Response.json(
            { documentId, runId: run.runId },
            { status: 202 }
          )
        } catch (error) {
          await updateDocument(documentId, { status: 'failed' })
          throw error
        }
      })
    ),
    GET('/pipeline/documents/:id', async (request, { params }) =>
      authenticated(request, '/pipeline/documents/:id', async () => {
        const id = documentIdSchema.safeParse(params.id)

        if (!id.success)
          return Response.json(
            { error: 'Invalid document ID' },
            { status: 400 }
          )

        const document = await findDocument(id.data)
        if (!document)
          return Response.json({ error: 'Document not found' }, { status: 404 })
        const runId = document.runId
        if (!runId)
          return Response.json(
            { error: 'Document run is unavailable' },
            { status: 409 }
          )

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
      authenticated(request, '/pipeline/documents/:id/review', async () => {
        const id = documentIdSchema.safeParse(params.id)
        const action = reviewActionSchema.safeParse(
          await request.json().catch(() => null)
        )

        if (!id.success || !action.success)
          return Response.json(
            { error: 'Invalid review action' },
            { status: 400 }
          )

        const document = await findDocument(id.data)
        if (!document)
          return Response.json({ error: 'Document not found' }, { status: 404 })
        if (!document.runId)
          return Response.json(
            { error: 'Review hook is unavailable' },
            { status: 409 }
          )

        // The workflow re-validates when applying; this refuses early so the browser can roll back.
        const refusal = await checkReviewAction(id.data, action.data)
        if (refusal) {
          log.info(
            { documentId: id.data, actionType: action.data.type, refusal },
            'Review action refused'
          )

          return Response.json(
            { error: 'Review action refused', refusal },
            { status: 409 }
          )
        }

        const runStatus = await getRun(document.runId).status
        if (runStatus !== 'running')
          return Response.json(
            { error: 'Review hook is unavailable' },
            { status: 409 }
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

        log.info(
          { documentId: id.data, actionType: action.data.type },
          'Review action accepted'
        )

        return Response.json({ accepted: true }, { status: 202 })
      })
    ),
  ],
})
