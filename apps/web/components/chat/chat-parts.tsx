'use client'

import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { isToolUIPart } from 'ai'
import Link from 'next/link'
import { useState } from 'react'
import { Streamdown } from 'streamdown'
import { ObservationCard } from '#components/observations/observation-card'
import { ObservationTrend } from '#components/observations/observation-trend'

type Part = ChatMessage['parts'][number]

/** Render cited text and the five typed clinical tool outputs without raw errors. */
export function ChatPart({
  part,
  context,
  role,
}: {
  part: Part
  context: PageContext
  role: ChatMessage['role']
}) {
  if (part.type === 'text') {
    return role === 'assistant' ? (
      <Streamdown
        skipHtml
        controls={false}
        className="text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_table]:text-xs [&_th]:bg-muted [&_th]:p-2 [&_td]:p-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm"
      >
        {part.text}
      </Streamdown>
    ) : (
      <p className="whitespace-pre-wrap break-words text-sm">{part.text}</p>
    )
  }

  if (!isToolUIPart(part)) return null
  if (part.state === 'output-error' || part.state === 'output-denied')
    return <p role="alert">This lookup could not be completed.</p>
  if (part.state !== 'output-available')
    return (
      <p className="text-muted-foreground" role="status">
        Looking up records…
      </p>
    )

  switch (part.type) {
    case 'tool-queryObservations':
      return <ObservationResults result={part.output} context={context} />
    case 'tool-observationTrend':
      return <ObservationTrend {...part.output} />
    case 'tool-reviewStatus': {
      const result = part.output
      return (
        <ul className="space-y-1 rounded-lg border p-3">
          <li>Status: {result.status}</li>
          <li>Flagged observations: {result.flaggedObservations}</li>
          <li>Unchecked observations: {result.uncheckedObservations}</li>
          <li>Redactions needing review: {result.redactionsNeedingReview}</li>
          <li>Identity mismatch: {result.identityMismatch ? 'Yes' : 'No'}</li>
          <li>Patient linked: {result.patientLinked ? 'Yes' : 'No'}</li>
        </ul>
      )
    }
    case 'tool-listDocuments':
      return (
        <ul className="divide-y rounded-lg border px-3">
          {part.output.documents.map((document) => (
            <li key={document.id} className="py-2">
              <Link
                href={`/documents/${encodeURIComponent(document.id)}`}
                className="text-primary underline"
              >
                {document.fileName}
              </Link>
              <p>
                {document.documentClass ?? 'Unclassified'} · {document.status}
              </p>
              <p className="text-muted-foreground">
                {document.patientId ?? 'No patient linked'} ·{' '}
                {document.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
          {part.output.documents.length === 0 && (
            <li className="py-2">No matching documents found.</li>
          )}
        </ul>
      )
    case 'tool-searchNotes':
      return (
        <ul className="space-y-2">
          {part.output.chunks.map((chunk) => (
            <li
              key={`${chunk.documentId}-${chunk.page}-${JSON.stringify(chunk.box)}`}
              className="rounded-lg border p-3"
            >
              <p className="whitespace-pre-wrap">{chunk.text}</p>
              <Link
                href={`/documents/${encodeURIComponent(chunk.documentId)}?page=${chunk.page}`}
                className="text-primary underline"
              >
                {chunk.documentId} · page {chunk.page}
              </Link>
            </li>
          ))}
          {part.output.chunks.length === 0 && <li>No matching notes found.</li>}
        </ul>
      )
    default:
      return null
  }
}

function ObservationResults({
  result,
  context,
}: {
  result: Extract<Part, { type: 'tool-queryObservations' }>['output']
  context: PageContext
}) {
  const [expanded, setExpanded] = useState(false)
  if (!result) return null

  const { summary, observations, truncated } = result
  const labels = {
    lab: 'labs',
    vital: 'vitals',
    'adverse-event': 'adverse events',
    'medical-history': 'medical histories',
    medication: 'medications',
    symptom: 'symptoms',
  }
  const href =
    context.page === 'document'
      ? `/documents/${encodeURIComponent(context.documentId)}?tab=observations`
      : context.page === 'patient'
        ? `/patients/${encodeURIComponent(context.patientId)}#observations`
        : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span>{summary.total} observations:</span>
        {Object.entries(summary.byKind)
          .filter(([, count]) => count > 0)
          .map(([kind, count]) => (
            <Badge key={kind} variant="secondary">
              {count} {labels[kind as keyof typeof labels]}
            </Badge>
          ))}
        <Badge variant="outline">{summary.outOfRange} out of range</Badge>
        <Badge variant="outline">{summary.unverified} unverified</Badge>
      </div>
      {observations
        .slice(0, expanded ? observations.length : 5)
        .map((observation) => (
          <ObservationCard key={observation.id} observation={observation} />
        ))}
      {observations.length === 0 && <p>No matching observations found.</p>}
      {observations.length > 5 && (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show ${observations.length - 5} more`}
        </Button>
      )}
      {Boolean(truncated) && (
        <p className="text-xs text-muted-foreground">
          Showing selected observations from the full matching set.
        </p>
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
