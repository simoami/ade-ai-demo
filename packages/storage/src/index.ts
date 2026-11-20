import {
  del,
  get,
  head,
  issueSignedToken,
  list,
  presignUrl,
  put,
} from '@vercel/blob'
import { type HandleUploadOptions, handleUpload } from '@vercel/blob/client'

type PutOptions = {
  contentType: string
  addRandomSuffix?: boolean
  allowOverwrite?: boolean
}

const blobClient = {
  put,
  get,
  head,
  list,
  del,
  handleUpload,
  issueSignedToken,
  presignUrl,
}

/** Creates a private-only storage adapter; the client can be replaced in tests. */
export function createStorage(client = blobClient) {
  return {
    async createReadSigner({ ttlMs = 15 * 60 * 1000 } = {}) {
      if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
        throw new Error('Invalid signed URL lifetime')
      }
      const validUntil = Date.now() + ttlMs
      // One token covers a request's reads; each URL's signature binds its own pathname,
      // and the signing key stays on the server.
      const token = await client.issueSignedToken({
        pathname: '*',
        operations: ['get'],
        validUntil,
      })
      return async (pathname: string) => {
        if (!pathname || pathname.includes('*')) {
          throw new Error('Invalid signed URL pathname')
        }
        return (
          await client.presignUrl(token, {
            operation: 'get',
            pathname,
            validUntil,
            access: 'private',
          })
        ).presignedUrl
      }
    },
    async put(
      pathname: string,
      body: Parameters<typeof put>[1],
      options: PutOptions
    ) {
      return client.put(pathname, body, { ...options, access: 'private' })
    },
    async get(pathname: string) {
      const result = await client.get(pathname, {
        access: 'private',
        useCache: false,
      })
      if (result === null) return null
      if (result.statusCode !== 200) {
        throw new Error('Unexpected storage response')
      }
      return { stream: result.stream, contentType: result.blob.contentType }
    },
    async head(pathname: string) {
      return client.head(pathname)
    },
    async list(prefix: string, cursor?: string) {
      return client.list({ prefix, cursor })
    },
    async delete(pathname: string | string[]) {
      await client.del(pathname)
    },
    async handleUpload(options: HandleUploadOptions) {
      return client.handleUpload(options)
    },
  }
}

/** Private blob operations; credentials are resolved by the provider on each call. */
export const storage = createStorage()

export type { HandleUploadBody, HandleUploadOptions } from '@vercel/blob/client'

/** Issues one read-only token and returns a local signer for file URLs, valid for fifteen minutes by default. */
export const createReadSigner = storage.createReadSigner
