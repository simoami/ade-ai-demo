import { Button } from '@repo/ui/components/button'
import { Check } from 'lucide-react'

/** Discard and, while reviewable, mark-as-reviewed buttons. */
export function ReviewActions({
  readOnly,
  canMarkReviewed,
  onDiscard,
  onMarkReviewed,
}: {
  readOnly: boolean
  canMarkReviewed: boolean
  onDiscard: () => void
  onMarkReviewed: () => void
}) {
  return (
    <div className="flex gap-2 [&_button]:h-[33px] [&_button]:text-[11px]">
      <Button
        variant="outline"
        size="lg"
        className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDiscard}
      >
        Discard document
      </Button>
      {!readOnly && (
        <Button size="lg" disabled={!canMarkReviewed} onClick={onMarkReviewed}>
          <Check data-icon="inline-start" />
          Mark as reviewed
        </Button>
      )}
    </div>
  )
}
