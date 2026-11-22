import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import Link from 'next/link'
import { formatDate } from '#lib/format'
import { type ObservationView, observationFlag } from '#lib/observations'

export type { ObservationView } from '#lib/observations'

/** Compact domain-specific content shared by cards and selectable review rows. */
export function ObservationSummary({
  observation,
}: {
  observation: ObservationView
}) {
  const { kind, name, value, unit, date, details, state } = observation
  const flag = kind === 'lab' ? observationFlag(observation) : null
  const range =
    details.referenceRange ||
    (details.rangeLow != null && details.rangeHigh != null
      ? `${details.rangeLow}–${details.rangeHigh}`
      : details.rangeLow != null
        ? `≥${details.rangeLow}`
        : details.rangeHigh != null
          ? `≤${details.rangeHigh}`
          : null)
  const dates = [
    details.startDate ? formatDate(details.startDate) : null,
    details.ongoing
      ? 'ongoing'
      : details.endDate
        ? formatDate(details.endDate)
        : null,
  ]
    .filter(Boolean)
    .join(' – ')
  const eventDetails =
    kind === 'adverse-event'
      ? [
          details.serious === true
            ? 'Serious'
            : details.serious === false
              ? 'Non-serious'
              : details.seriousness,
          details.outcome?.replaceAll('-', ' '),
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  return (
    <span className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="font-medium">{name}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span>
          {value}
          {unit && !value.endsWith(unit) ? ` ${unit}` : ''}
        </span>
        {flag !== null && (
          <Badge
            variant="outline"
            className={cn(
              flag === 'normal'
                ? 'bg-success-muted text-success'
                : flag === 'abnormal'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning-muted text-warning'
            )}
          >
            {flag}
          </Badge>
        )}
        {(state === 'needsReview' || state === 'extracted') && (
          <Badge variant="outline">Unverified</Badge>
        )}
      </span>
      {kind === 'lab' && range && (
        <span className="text-xs text-muted-foreground">
          Reference: {range} {unit}
        </span>
      )}
      {eventDetails.length > 0 && (
        <span className="text-xs text-muted-foreground">{eventDetails}</span>
      )}
      {kind === 'medication' && Boolean(details.route || details.frequency) && (
        <span className="text-xs text-muted-foreground">
          {[details.route, details.frequency].filter(Boolean).join(' · ')}
        </span>
      )}
      {Boolean(dates || date) && (
        <span className="text-xs text-muted-foreground">
          {dates || formatDate(date)}
        </span>
      )}
    </span>
  )
}

/** Clinical observation with its verification state and a source-page citation. */
export function ObservationCard({
  observation,
}: {
  observation: ObservationView
}) {
  return (
    <article className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <ObservationSummary observation={observation} />
      <footer className="text-xs text-muted-foreground">
        {observation.documentId ? (
          <Link
            className="underline underline-offset-2"
            href={`/documents/${observation.documentId}?page=${observation.page}`}
          >
            Page {observation.page}
          </Link>
        ) : (
          `Page ${observation.page}`
        )}
      </footer>
    </article>
  )
}
