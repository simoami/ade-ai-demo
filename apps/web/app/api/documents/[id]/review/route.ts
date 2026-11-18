import { documentIdSchema, reviewActionSchema } from '@repo/ai/review-action'
import { pipeline, pipelineFailure } from '@/lib/server/pipeline-client'

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
    return Response.json(await pipeline.review(id.data, action.data), {
      status: 202,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}
