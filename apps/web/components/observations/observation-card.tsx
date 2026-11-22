import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatDate } from '#lib/format'
import { type ObservationView, observationFlag } from '#lib/observations'

export type { ObservationView } from '#lib/observations'

/** Compact clinical card with optional review actions and keyboard-accessible selection. */
export function ObservationCard({
  observation,
  actions,
  selected = false,
  onSelect,
}: {
  observation: ObservationView
  actions?: ReactNode
  selected?: boolean
  onSelect?: () => void
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

  const stateLabel = {
    accepted: 'Accepted',
    rejected: 'Rejected',
    extracted: 'Extracted',
    needsReview: 'Needs review',
  }[state]

  return (
    <article
      className={cn(
        'relative flex flex-col gap-1.5 rounded-md border bg-card p-3 text-sm',
        selected && 'border-primary bg-accent'
      )}
    >
      <header className="flex items-start justify-between gap-2">
        {onSelect ? (
          <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className="min-w-0 break-words text-left font-medium after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {name}
          </button>
        ) : (
          <span className="min-w-0 break-words font-medium">{name}</span>
        )}
        <div className="relative z-10 ml-auto shrink-0">
          {actions ?? (
            <Badge
              variant="outline"
              className={
                state === 'rejected'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }
              title={
                state === 'extracted' || state === 'needsReview'
                  ? 'Unverified observation'
                  : undefined
              }
            >
              {stateLabel}
            </Badge>
          )}
        </div>
      </header>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="break-words">
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
          {kind === 'lab' && range && (
            <span className="text-xs text-muted-foreground">
              Reference: {range} {unit}
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-x-2 text-right text-xs text-muted-foreground">
          {Boolean(dates || date) && <span>{dates || formatDate(date)}</span>}
          {observation.documentId ? (
            <Link
              className="relative z-10 underline underline-offset-2"
              href={`/documents/${encodeURIComponent(observation.documentId)}?page=${observation.page}`}
            >
              Page {observation.page}
            </Link>
          ) : (
            <span>Page {observation.page}</span>
          )}
        </div>
      </div>
      {eventDetails.length > 0 && (
        <p className="text-xs text-muted-foreground">{eventDetails}</p>
      )}
      {kind === 'medication' && Boolean(details.route || details.frequency) && (
        <p className="text-xs text-muted-foreground">
          {[details.route, details.frequency].filter(Boolean).join(' · ')}
        </p>
      )}
    </article>
  )
}
