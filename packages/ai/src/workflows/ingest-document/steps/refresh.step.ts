import type { ReviewAction } from '../review-action'

export async function refresh(
  _documentId: string,
  _action: ReviewAction,
  refreshCount: number
) {
  'use step'

  // A recorded result proves each action crosses a durable step without storing content.
  return refreshCount + 1
}
