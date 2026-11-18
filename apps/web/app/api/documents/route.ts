import { startDocumentSchema } from '@repo/ai/review-action'
import { pipeline, pipelineFailure } from '#lib/server/pipeline-client'

/** Starts a synthetic document run after validating the fixture request. */
export async function POST(request: Request) {
  const parsed = startDocumentSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return Response.json({ error: 'Invalid fixture request' }, { status: 400 })
  try {
    return Response.json(await pipeline.start(parsed.data), {
      status: 202,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}
