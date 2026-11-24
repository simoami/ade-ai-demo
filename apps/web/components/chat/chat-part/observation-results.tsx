import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import Link from 'next/link'
import { useState } from 'react'
import { ObservationCard } from '#components/observations/observation-card'
import { observationKindLabels } from '#lib/observations'

// Cards shown before "Show more"; enough for a glance without pushing the answer off screen.
const COLLAPSED_CARD_COUNT = 5

/** Links to the full observation list for the scoped record; list pages have none. */
function observationsHref(context: PageContext) {
  if (context.page === 'document')
    return `/documents/${encodeURIComponent(context.documentId)}?tab=observations`
  if (context.page === 'patient')
    return `/patients/${encodeURIComponent(context.patientId)}#observations`
  return null
}

/** Observation query summary and cards, collapsed to the first few, with a link to the full list. */
export function ObservationResults({
  result,
  context,
}: {
  result: Extract<
    ChatMessage['parts'][number],
    { type: 'tool-queryObservations' }
  >['output']
  context: PageContext
}) {
  const [expanded, setExpanded] = useState(false)
  if (!result) return null

  const { summary, observations } = result
  const href = observationsHref(context)
  const hiddenCount = observations.length - COLLAPSED_CARD_COUNT

  function handleToggle() {
    setExpanded((previous) => !previous)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span>{summary.total} observations:</span>
        {Object.entries(summary.byKind)
          .filter(([, count]) => count > 0)
          .map(([kind, count]) => (
            <Badge key={kind} variant="secondary">
              {count}{' '}
              {observationKindLabels[
                kind as keyof typeof observationKindLabels
              ][count === 1 ? 'one' : 'other'].toLowerCase()}
            </Badge>
          ))}
        {summary.outOfRange > 0 && (
          <Badge variant="outline">{summary.outOfRange} out of range</Badge>
        )}
        {summary.unverified > 0 && (
          <Badge variant="outline">{summary.unverified} unverified</Badge>
        )}
      </div>
      {observations
        .slice(0, expanded ? observations.length : COLLAPSED_CARD_COUNT)
        .map((observation) => (
          <ObservationCard key={observation.id} observation={observation} />
        ))}
      {observations.length === 0 && <p>No matching observations found.</p>}
      {hiddenCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          aria-expanded={expanded}
          onClick={handleToggle}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </Button>
      )}
      {href !== null && (
        <Link href={href} className="block text-xs text-primary underline">
          {context.page === 'document'
            ? 'Open in Observations tab'
            : 'Open in Observations'}
        </Link>
      )}
    </div>
  )
}
