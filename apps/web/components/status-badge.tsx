import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import type { DocumentStatus } from '#lib/sample-records'

const labels: Record<DocumentStatus, string> = {
  rendering: 'Rendering',
  reading: 'Reading text',
  redacting: 'Redacting',
  extracting: 'Extracting',
  needsReview: 'Needs review',
  reviewed: 'Reviewed',
  discarded: 'Discarded',
  unsupported: 'Unsupported',
}

const tones: Partial<Record<DocumentStatus, string>> = {
  needsReview:
    'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  reviewed:
    'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  discarded: 'bg-destructive/10 text-destructive',
}

/** Shows where a document is in the pipeline or its review. */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn('h-5.5 text-xs font-medium', tones[status])}
    >
      {labels[status]}
    </Badge>
  )
}
