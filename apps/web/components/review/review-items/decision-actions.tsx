import { Button } from '@repo/ui/components/button'
import { Check, X } from 'lucide-react'

/** Accept and reject buttons for an item that needs review. */
export function DecisionActions({
  onAccept,
  onReject,
}: {
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="outline" size="sm" onClick={onAccept}>
        <Check data-icon="inline-start" />
        Accept
      </Button>
      <Button variant="outline" size="sm" onClick={onReject}>
        <X data-icon="inline-start" />
        Reject
      </Button>
    </div>
  )
}
