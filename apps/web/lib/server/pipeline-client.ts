import {
  documentStatusSchema,
  type ReviewAction,
  reviewResultSchema,
  type startDocumentSchema,
  startResultSchema,
} from '@repo/ai/review-action'
import { logger } from '@repo/logger'
import { getVercelOidcToken } from '@vercel/oidc'
import type { z } from 'zod'
import { validateEnvironment } from '#lib/server/environment'

const log = logger.getSubLogger({ name: 'pipeline-client' })

const failures = {
  400: 'Invalid pipeline request',
  404: 'Document not found',
  409: 'Review hook is unavailable',
  503: 'Service unavailable',
} as const

/** Carries a safe pipeline HTTP status and public error message. */
export class PipelineError extends Error {
  readonly status: keyof typeof failures

  constructor(status: keyof typeof failures = 503) {
    super(failures[status])
    this.status = status
  }
}

async function call<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown
): Promise<T> {
  let status = 503

  try {
    const env = validateEnvironment(process.env)
    const authorization = env.vercel
      ? `Bearer ${await getVercelOidcToken()}`
      : `Basic ${Buffer.from(`pipeline:${env.PIPELINE_SERVICE_SECRET}`).toString('base64')}`
    const response = await fetch(
      new URL(`pipeline/documents${path}`, env.PIPELINE_SERVICE_ORIGIN),
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      }
    )

    if (!response.ok) {
      status = response.status

      throw new PipelineError(
        response.status === 400 ||
          response.status === 404 ||
          response.status === 409
          ? response.status
          : 503
      )
    }

    return schema.parse(await response.json())
  } catch (error) {
    // Messages may carry document content, so only the error type is logged.
    log.error(
      {
        path: `/pipeline/documents${path}`,
        status,
        errorType: error instanceof Error ? error.name : typeof error,
      },
      'Pipeline call failed'
    )

    throw error instanceof PipelineError ? error : new PipelineError()
  }
}

/** Authenticated document service client with validated responses. */
export const pipeline = {
  start: (input: z.infer<typeof startDocumentSchema>) =>
    call('', startResultSchema, input),
  status: (documentId: string) =>
    call(`/${encodeURIComponent(documentId)}`, documentStatusSchema),
  review: (documentId: string, action: ReviewAction) =>
    call(
      `/${encodeURIComponent(documentId)}/review`,
      reviewResultSchema,
      action
    ),
}

/** Converts failures into content-free HTTP error responses. */
export function pipelineFailure(error: unknown): Response {
  const failure = error instanceof PipelineError ? error : new PipelineError()
  return Response.json(
    { error: failure.message },
    { status: failure.status, headers: { 'cache-control': 'no-store' } }
  )
}
