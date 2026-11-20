import { startDocumentSchema } from '@repo/ai/review-action'
import { pipeline, pipelineFailure } from '#lib/server/pipeline-client'
import { recordCache } from '#lib/server/record-cache'

/** Starts processing after validating the uploaded document request. */
export async function POST(request: Request) {
  const parsed = startDocumentSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return Response.json({ error: 'Invalid document request' }, { status: 400 })
  try {
    const result = await pipeline.start(parsed.data)
    recordCache.invalidate(result.documentId)
    return Response.json(result, {
      status: 202,
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}

/** Forwards an authenticated workspace reset to the document service. */
export async function DELETE() {
  try {
    const result = await pipeline.deleteDocuments()
    recordCache.invalidate()
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return pipelineFailure(error)
  }
}
