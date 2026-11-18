import { documentIdSchema } from '@repo/ai/review-action'
import { pipeline, pipelineFailure } from '@/lib/server/pipeline-client'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = documentIdSchema.safeParse((await context.params).id)
  if (!id.success)
    return Response.json({ error: 'Invalid document ID' }, { status: 400 })
  try {
    return Response.json(await pipeline.status(id.data), {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}
