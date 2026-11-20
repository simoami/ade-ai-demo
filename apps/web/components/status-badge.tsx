import { Badge } from '@repo/ui/components/badge'
import { ShineBorder } from '@repo/ui/components/shine-border'
import { cn } from '@repo/ui/lib/utils'
import { Sparkles } from 'lucide-react'
import { documentStatusLabels, reviewMode } from '#lib/review'
import type { DocumentStatus } from '#lib/sample-records'

const tones: Partial<Record<DocumentStatus, string>> = {
  needsReview: 'bg-warning-muted text-warning',
  reviewed: 'bg-success-muted text-success',
  discarded: 'bg-destructive/10 text-destructive',
}

/** Shows where a document is in the pipeline or its review. */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  if (reviewMode(status) === 'processing') {
    return (
      <ShineBorder
        className="inline-flex rounded-full align-middle"
        borderWidth={1}
      >
        <Badge variant="ghost" className="gap-1.5 text-primary">
          <Sparkles />
          {documentStatusLabels[status]}
        </Badge>
      </ShineBorder>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={cn('gap-1.5 bg-info-muted text-info', tones[status])}
    >
      <span className="size-1 rounded-full bg-current" />
      {documentStatusLabels[status]}
    </Badge>
  )
}
