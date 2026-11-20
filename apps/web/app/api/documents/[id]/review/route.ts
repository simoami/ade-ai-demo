import { documentIdSchema, reviewActionSchema } from '@repo/ai/review-action'
import { pipeline, pipelineFailure } from '#lib/server/pipeline-client'
import { recordCache } from '#lib/server/record-cache'

/** Submits a validated document review decision to the service. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = documentIdSchema.safeParse((await context.params).id)
  const action = reviewActionSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!id.success || !action.success)
    return Response.json({ error: 'Invalid review action' }, { status: 400 })
  try {
    const result = await pipeline.review(id.data, action.data)
    recordCache.invalidate(id.data)
    return Response.json(result, {
      status: 202,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}
