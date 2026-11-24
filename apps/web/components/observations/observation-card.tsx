import { Card } from '@repo/ui/components/card'
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
import { type ObservationView, observationKindLabels } from '#lib/observations'
import { KindDetail } from './observation-card/kind-detail.tsx'
import { RangeBar } from './observation-card/range-bar.tsx'
import { ReviewState } from './observation-card/review-state.tsx'

const kindIcons = {
  lab: FlaskConical,
  vital: HeartPulse,
  symptom: Stethoscope,
  'adverse-event': AlertTriangle,
  'medical-history': History,
  medication: Pill,
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
  const Icon = kindIcons[kind]
  const measured = kind === 'lab' || kind === 'vital'

  return (
    <Card
      render={<article />}
      className={cn(
        'relative flex gap-2 rounded-md border-l-2 p-2.5 text-sm',
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
              {observationKindLabels[kind].one}
            </p>
            {onSelect ? (
              // The pseudo-element stretches over the card so the whole card selects; actions and links sit above it with z-10.
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
    </Card>
  )
}
