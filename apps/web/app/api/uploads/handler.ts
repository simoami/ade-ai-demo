import { logger } from '@repo/logger'
import { type HandleUploadBody, storage } from '@repo/storage'
import { z } from 'zod'

const log = logger.getSubLogger({ name: 'uploads' })

const pathnameSchema = z
  .string()
  .regex(/^uploads\/[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/)
  .refine((pathname) =>
    pathname
      .split('/')
      .every((part) => part !== '' && part !== '.' && part !== '..')
  )

/** Creates the upload endpoint with an injectable token handler for offline tests. */
export function createUploadHandler(handleUpload = storage.handleUpload) {
  return async (request: Request): Promise<Response> => {
    let body: HandleUploadBody
    try {
      body = (await request.json()) as HandleUploadBody
    } catch {
      return Response.json({ error: 'Invalid upload request' }, { status: 400 })
    }

    try {
      // Vercel Deployment Protection provides access control; the app has no auth code.
      const result = await handleUpload({
        request,
        body,
        onBeforeGenerateToken: async (pathname) => {
          pathnameSchema.parse(pathname)
          return {
            allowedContentTypes: ['application/pdf', 'image/png', 'image/jpeg'],
            maximumSizeInBytes: 20 * 1024 * 1024,
            addRandomSuffix: true,
            allowOverwrite: false,
          }
        },
        onUploadCompleted: async () => {
          log.info('Upload completed', { count: 1 })
        },
      })
      return Response.json(result)
    } catch {
      log.warn('Upload request failed', { status: 'failed' })
      return Response.json({ error: 'Upload unavailable' }, { status: 503 })
    }
  }
}
