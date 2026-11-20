import { logger } from '@repo/logger'
import { storage } from '@repo/storage'
import { z } from 'zod'

const log = logger.getSubLogger({ name: 'files' })

const pathnameSchema = z
  .array(
    z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9_.-]+$/)
      .refine((part) => part !== '.' && part !== '..')
  )
  .min(2)
  .refine((parts) => parts[0] === 'documents')

type Context = { params: Promise<{ pathname: string[] }> }

/** Creates a private file endpoint limited to document artifacts. */
export function createFileHandler(get = storage.get) {
  return async (_request: Request, context: Context): Promise<Response> => {
    const parsed = pathnameSchema.safeParse((await context.params).pathname)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid pathname' }, { status: 400 })
    }

    try {
      // Vercel Deployment Protection provides access control; the app has no auth code.
      const result = await get(parsed.data.join('/'))
      if (result === null) return new Response('Not found', { status: 404 })
      return new Response(result.stream, {
        headers: {
          'Cache-Control': 'private, no-cache',
          'Content-Type': result.contentType,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      log.warn('File request failed', { status: 'failed' })
      return Response.json({ error: 'File unavailable' }, { status: 503 })
    }
  }
}
