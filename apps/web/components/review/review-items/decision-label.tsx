import { cn } from '@repo/ui/lib/utils'

/** Muted text recording an accepted or rejected decision. */
export function DecisionLabel({ state }: { state: 'accepted' | 'rejected' }) {
  return (
    <span
      className={cn(
        'text-xs',
        state === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {state === 'accepted' ? 'Accepted' : 'Rejected'}
    </span>
  )
}
