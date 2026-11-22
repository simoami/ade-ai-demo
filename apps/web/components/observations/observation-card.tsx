import { Badge } from '@repo/ui/components/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { cn } from '@repo/ui/lib/utils'
import {
  AlertTriangle,
  FlaskConical,
  HeartPulse,
  History,
  Pill,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { formatDate } from '#lib/format'
import { type ObservationView, observationFlag } from '#lib/observations'

export type { ObservationView } from '#lib/observations'

type Flag = NonNullable<ReturnType<typeof observationFlag>>

const kinds = {
  lab: { label: 'Lab', icon: FlaskConical },
  vital: { label: 'Vital', icon: HeartPulse },
  symptom: { label: 'Symptom', icon: Stethoscope },
  'adverse-event': { label: 'Adverse event', icon: AlertTriangle },
  'medical-history': { label: 'Medical history', icon: History },
  medication: { label: 'Medication', icon: Pill },
}

const flagTones: Record<Flag, { badge: string; marker: string }> = {
  normal: { badge: 'bg-success-muted text-success', marker: 'bg-success' },
  low: { badge: 'bg-warning-muted text-warning', marker: 'bg-warning' },
  high: { badge: 'bg-warning-muted text-warning', marker: 'bg-warning' },
  abnormal: {
    badge: 'bg-destructive/10 text-destructive',
    marker: 'bg-destructive',
  },
}

/** Kind-accented clinical card with optional review actions and keyboard-accessible selection. */
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
  const { kind, name, date, page, documentId } = observation
  const Icon = kinds[kind].icon
  const measured = kind === 'lab' || kind === 'vital'

  return (
    <article
      className={cn(
        'relative flex gap-2 rounded-md border border-l-2 bg-card p-2.5 text-sm',
        selected && 'border-primary bg-accent'
      )}
    >
      <Icon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {kinds[kind].label}
            </p>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected}
                onClick={onSelect}
                className="text-left font-medium wrap-break-word after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {name}
              </button>
            ) : (
              <h3 className="font-medium wrap-break-word">{name}</h3>
            )}
          </div>
          <div className="relative z-10 shrink-0">
            {actions ?? <ReviewState state={observation.state} />}
          </div>
        </header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <KindDetail observation={observation} />
          </div>
          <div className="relative z-10 flex shrink-0 flex-col items-end text-xs text-muted-foreground">
            {(measured || kind === 'symptom') && date && (
              <span>{formatDate(date)}</span>
            )}
            {documentId ? (
              <Link
                className="underline underline-offset-2"
                href={`/documents/${encodeURIComponent(documentId)}?page=${page}`}
              >
                Page {page}
              </Link>
            ) : (
              <span>Page {page}</span>
            )}
          </div>
        </div>
        {measured ? <RangeBar observation={observation} /> : null}
      </div>
    </article>
  )
}

function KindDetail({ observation }: { observation: ObservationView }) {
  const { kind, value, unit, details } = observation
  const muted = 'text-xs text-muted-foreground'
  const period = [
    details.startDate ? formatDate(details.startDate) : null,
    details.ongoing
      ? 'Ongoing'
      : details.endDate
        ? formatDate(details.endDate)
        : null,
  ]
    .filter(Boolean)
    .join(' – ')

  switch (kind) {
    case 'lab':
    case 'vital': {
      const flag = observationFlag(observation)
      const range = referenceRange(observation)
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-lg font-semibold tabular-nums">
            {value}
            {unit && !value.endsWith(unit) && (
              <span className="ms-1 font-sans text-sm font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </span>
          {flag && (
            <Badge
              variant="outline"
              className={cn('border-transparent', flagTones[flag].badge)}
            >
              {flag}
            </Badge>
          )}
          {range && <span className={muted}>Ref {range}</span>}
        </div>
      )
    }
    case 'adverse-event':
      return (
        <div className={cn('flex flex-wrap items-center gap-1.5', muted)}>
          {period && <span>{period}</span>}
          {details.serious ? (
            <Badge variant="destructive">Serious</Badge>
          ) : (
            <span>
              {details.serious === false ? 'Non-serious' : details.seriousness}
            </span>
          )}
          {details.outcome ? (
            <span>· {details.outcome.replaceAll('-', ' ')}</span>
          ) : null}
        </div>
      )
    case 'medical-history':
      return (
        <div className={cn('flex flex-wrap items-center gap-2', muted)}>
          {details.startDate ? (
            <span>
              Since {formatDate(details.startDate)}
              {!details.ongoing && details.endDate
                ? ` – ${formatDate(details.endDate)}`
                : ''}
            </span>
          ) : null}
          {Boolean(details.ongoing) && <Badge variant="outline">Ongoing</Badge>}
        </div>
      )
    case 'medication':
      return (
        <div>
          <p className="font-medium">{value}</p>
          {Boolean(details.route || details.frequency) && (
            <p className={muted}>
              {[details.route, details.frequency].filter(Boolean).join(' · ')}
            </p>
          )}
          {period && <p className={muted}>{period}</p>}
        </div>
      )
    case 'symptom':
      return <p className="text-muted-foreground">{value}</p>
  }
}

function ReviewState({ state }: { state: ObservationView['state'] }) {
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

/** Plots the value against its reference bounds, padded so out-of-range values stay visible. */
function RangeBar({ observation }: { observation: ObservationView }) {
  const { rangeLow: low, rangeHigh: high } = observation.details
  const value = observation.valueNumeric
  const flag = observationFlag(observation)
  if (low == null || high == null || value === null || high <= low || !flag)
    return null

  const padding = (high - low) / 4
  const start = Math.min(low, value) - padding
  const span = Math.max(high, value) + padding - start
  const percent = (point: number) => `${((point - start) / span) * 100}%`

  return (
    <div
      role="img"
      aria-label={`${observation.value} is ${flag}; reference ${low}–${high}`}
      className="relative mt-1 h-1.5 rounded-full bg-muted"
    >
      <span
        className="absolute inset-y-0 rounded-full bg-success-muted"
        style={{ left: percent(low), right: `calc(100% - ${percent(high)})` }}
      />
      <span
        className={cn(
          'absolute top-1/2 size-2.5 -translate-1/2 rounded-full border-2 border-card',
          flagTones[flag].marker
        )}
        style={{ left: percent(value) }}
      />
    </div>
  )
}

function referenceRange({ details, unit }: ObservationView) {
  if (details.referenceRange) return details.referenceRange

  const { rangeLow: low, rangeHigh: high } = details
  const bounds =
    low != null && high != null
      ? `${low}–${high}`
      : low != null
        ? `≥${low}`
        : high != null
          ? `≤${high}`
          : null
  return bounds && unit ? `${bounds} ${unit}` : bounds
}
