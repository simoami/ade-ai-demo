import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import type { MatchStrength } from '#lib/review'

const strengthLabels = {
  strong: 'Strong match',
  partial: 'Identity mismatch',
  none: 'No match',
} as const satisfies Record<MatchStrength, string>

/** Badge toned by how well the document identifiers match a patient. */
export function StrengthBadge({ strength }: { strength: MatchStrength }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        strength === 'strong' && 'bg-success-muted text-success',
        strength === 'partial' && 'bg-warning-muted text-warning'
      )}
    >
      {strengthLabels[strength]}
    </Badge>
  )
}
