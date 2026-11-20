import {
  chatSessions,
  createDb,
  documents,
  noteChunks,
  observations,
  redactions,
  reviewEvents,
  sql,
} from '@repo/db'
import { logger } from '@repo/logger'
import { storage } from '@repo/storage'
import { DELETE, defineChannel } from 'eve/channels'
import { getRun } from 'eve/workflow/api'
import { authenticatePipeline } from '#agent/lib/pipeline-auth'

const log = logger.getSubLogger({ name: 'documents-admin' })

const deletionDependencies = {
  authenticate: authenticatePipeline,
  listDocuments: async () =>
    createDb().select({ runId: documents.runId }).from(documents),
  cancelRun: async (runId: string) => {
    const run = getRun(runId)
    const status = await run.status
    if (status === 'running' || status === 'pending') await run.cancel()
  },
  storage,
  deleteRows: async () => {
    const db = createDb()
    // Neon HTTP batches execute in one transaction; entity rows cascade from chunks.
    const result = await db.batch([
      db.delete(reviewEvents),
      db.delete(redactions),
      db.delete(observations),
      db.delete(noteChunks),
      db
        .delete(chatSessions)
        .where(sql`${chatSessions.documentId} is not null`),
      db.delete(documents).returning({ id: documents.id }),
    ])
    return result[5].length
  },
}

type DeletionDependencies = {
  authenticate: (request: Request) => Promise<unknown>
  listDocuments: () => Promise<{ runId: string | null }[]>
  cancelRun: (runId: string) => Promise<void>
  storage: Pick<typeof storage, 'list' | 'delete'>
  deleteRows: () => Promise<number>
}

/** Authenticates demo resets and removes document artifacts and rows, preserving patients. */
export async function deleteDocuments(
  request: Request,
  dependencies: DeletionDependencies = deletionDependencies
): Promise<Response> {
  try {
    const auth = await dependencies.authenticate(request)
    if (auth instanceof Response) return auth

    const rows = await dependencies.listDocuments()
    let cancellationFailures = 0
    for (const { runId } of rows) {
      if (!runId) continue
      try {
        await dependencies.cancelRun(runId)
      } catch {
        // A run may have finished between inspection and cancellation.
        cancellationFailures++
      }
    }
    if (cancellationFailures > 0)
      log.warn(
        { count: cancellationFailures },
        'Run cancellation attempts failed'
      )

    let blobCount = 0
    for (const prefix of ['documents/', 'uploads/']) {
      let cursor: string | undefined
      do {
        const page = await dependencies.storage.list(prefix, cursor)
        if (page.blobs.length > 0) {
          await dependencies.storage.delete(
            page.blobs.map((blob) => blob.pathname)
          )
          blobCount += page.blobs.length
        }
        cursor = page.hasMore ? page.cursor : undefined
        if (page.hasMore && !cursor) throw new Error('Missing storage cursor')
      } while (cursor)
    }

    const deleted = await dependencies.deleteRows()
    log.info({ deleted, blobCount }, 'Documents deleted')
    return Response.json(
      { deleted },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (error) {
    log.error(
      {
        status: 503,
        errorType: error instanceof Error ? error.name : typeof error,
      },
      'Document deletion failed'
    )
    return Response.json({ error: 'Service unavailable' }, { status: 503 })
  }
}

/** Exposes the authenticated demo workspace reset. */
export default defineChannel({
  routes: [
    DELETE('/pipeline/documents', (request) => deleteDocuments(request)),
  ],
})
