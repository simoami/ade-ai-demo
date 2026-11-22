'use client'

import type { ChatMessage } from '@repo/ai/chat'
import { isToolUIPart } from 'ai'
import Link from 'next/link'
import { ObservationCard } from '#components/observations/observation-card'
import { ObservationTrend } from '#components/observations/observation-trend'

type Part = ChatMessage['parts'][number]

/** Render cited text and the five typed clinical tool outputs without raw errors. */
export function ChatPart({ part }: { part: Part }) {
  if (part.type === 'text') {
    const segments = part.text.split(/(\[[^\]]+\]\(\/documents\/[^\s)]+\))/g)
    return (
      <p className="whitespace-pre-wrap break-words">
        {segments.map((segment) => {
          const link = /^\[([^\]]+)\]\((\/documents\/[^\s)]+)\)$/.exec(segment)
          return link ? (
            <Link
              key={segment}
              href={link[2] ?? '/documents'}
              className="text-primary underline"
            >
              {link[1]}
            </Link>
          ) : (
            segment
          )
        })}
      </p>
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
      return part.output.observations.length ? (
        <div className="space-y-2">
          {part.output.observations.map((observation) => (
            <ObservationCard key={observation.id} observation={observation} />
          ))}
        </div>
      ) : (
        <p>No matching observations found.</p>
      )
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
