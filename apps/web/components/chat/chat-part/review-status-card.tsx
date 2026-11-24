import type { ChatMessage } from '@repo/ai/chat'
import { Card } from '@repo/ui/components/card'

/** What still blocks a document's review, as reported by the review status tool. */
export function ReviewStatusCard({
  result,
}: {
  result: Extract<
    ChatMessage['parts'][number],
    { type: 'tool-reviewStatus'; state: 'output-available' }
  >['output']
}) {
  return (
    <Card render={<ul />} className="flex flex-col gap-1 p-3">
      <li>Status: {result.status}</li>
      <li>Flagged observations: {result.flaggedObservations}</li>
      <li>Unchecked observations: {result.uncheckedObservations}</li>
      <li>Redactions needing review: {result.redactionsNeedingReview}</li>
      <li>Identity mismatch: {result.identityMismatch ? 'Yes' : 'No'}</li>
      <li>Patient linked: {result.patientLinked ? 'Yes' : 'No'}</li>
    </Card>
  )
}
