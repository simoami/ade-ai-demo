import { createDb, documents, eq } from '@repo/db'
import { logger } from '@repo/logger'
import { storage } from '@repo/storage'
import { z } from 'zod'

const log = logger.getSubLogger({ name: 'files' })

const pathnameSchema = z.union([
  z.tuple([
    z.literal('documents'),
    z.uuid(),
    z.literal('pages'),
    z.string().regex(/^[1-9][0-9]*\.webp$/),
  ]),
  z.tuple([
    z.literal('documents'),
    z.uuid(),
    z.literal('render'),
    z.string().regex(/^[1-9][0-9]*\.png$/),
  ]),
])

async function getDocumentStatus(id: string) {
  const [row] = await createDb()
    .select({ status: documents.status })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)
  return row?.status
}

type Context = { params: Promise<{ pathname: string[] }> }

/** Serves redacted pages and status-gated unredacted processing previews. */
export function createFileHandler(
  get = storage.get,
  getStatus = getDocumentStatus
) {
  return async (_request: Request, context: Context): Promise<Response> => {
    const parsed = pathnameSchema.safeParse((await context.params).pathname)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid pathname' }, { status: 400 })
    }

    try {
      const isRender = parsed.data[2] === 'render'
      if (isRender) {
        const status = await getStatus(parsed.data[1])
        if (status !== 'reading' && status !== 'redacting') {
          return new Response('Not found', { status: 404 })
        }
      }

      // Vercel Deployment Protection provides access control; the app has no auth code.
      const result = await get(parsed.data.join('/'))
      if (result === null) return new Response('Not found', { status: 404 })
      return new Response(result.stream, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': isRender ? 'image/png' : 'image/webp',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      log.warn('File request failed', { status: 'failed' })
      return Response.json({ error: 'File unavailable' }, { status: 503 })
    }
  }
}
