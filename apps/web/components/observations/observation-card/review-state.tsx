import { Badge } from '@repo/ui/components/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import type { ObservationView } from '#lib/observations'

/** Review decision badge; unverified states explain themselves in a tooltip. */
export function ReviewState({ state }: { state: ObservationView['state'] }) {
  if (state === 'accepted')
    return (
      <Badge
        variant="outline"
        className="border-transparent bg-success-muted text-success"
      >
        Accepted
      </Badge>
    )
  if (state === 'rejected')
    return (
      <Badge variant="outline" className="text-destructive">
        Rejected
      </Badge>
    )

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant="outline" className="text-muted-foreground" />}
      >
        {state === 'needsReview' ? 'Needs review' : 'Extracted'}
      </TooltipTrigger>
      <TooltipContent>Unverified observation</TooltipContent>
    </Tooltip>
  )
}
