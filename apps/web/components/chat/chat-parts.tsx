'use client'

import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@repo/ui/components/popover'
import { isToolUIPart } from 'ai'
import Link from 'next/link'
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useState,
} from 'react'
import { defaultComponents, Streamdown } from 'streamdown'
import { ObservationCard } from '#components/observations/observation-card'
import { ObservationTrend } from '#components/observations/observation-trend'
import { citationNumbers, parseCitation } from '#lib/citations'
import { noteExcerpts, pageKey } from '#lib/note-excerpts'
import { observationKindLabels } from '#lib/observations'

type Part = ChatMessage['parts'][number]

const CitationContext = createContext<{
  numbers: Map<string, number>
  documents: { id: string; fileName: string }[]
  excerpts: ReturnType<typeof noteExcerpts>
}>({ numbers: new Map(), documents: [], excerpts: new Map() })

const markdownComponents = { a: CitationLink }

/** Numbers one message's page citations and resolves their file names and note excerpts. */
export function MessageCitations({
  parts,
  documents,
  children,
}: {
  parts: ChatMessage['parts']
  documents: { id: string; fileName: string }[]
  children: ReactNode
}) {
  const text = parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
  // Excerpts come from this message's own note searches, so a citation only previews text the answer saw.
  const excerpts = noteExcerpts(
    parts.flatMap((part) =>
      part.type === 'tool-searchNotes' && part.state === 'output-available'
        ? part.output.chunks
        : []
    )
  )

  return (
    <CitationContext
      value={{ numbers: citationNumbers(text), documents, excerpts }}
    >
      {children}
    </CitationContext>
  )
}

/** Renders cited text and the typed clinical tool outputs without raw errors; note searches surface through citation popovers. */
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
        components={markdownComponents}
        className="text-sm leading-7 wrap-break-word [&_li]:leading-7 [&_p]:leading-7 [&_a]:text-primary [&_a]:underline [&_table]:text-xs [&_th]:bg-muted [&_th]:p-2 [&_td]:p-2 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm"
      >
        {part.text}
      </Streamdown>
    ) : (
      <p className="whitespace-pre-wrap wrap-break-word text-sm">{part.text}</p>
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
      return part.input.display === false ? null : (
        <ObservationResults result={part.output} context={context} />
      )
    case 'tool-observationTrend':
      return <ObservationTrend {...part.output} />
    case 'tool-reviewStatus': {
      const result = part.output
      return (
        <Card render={<ul />} className="flex flex-col gap-1 p-3">
          <li>Status: {result.status}</li>
          <li>Flagged observations: {result.flaggedObservations}</li>
          <li>Unchecked observations: {result.uncheckedObservations}</li>
          <li>Redactions needing review: {result.redactionsNeedingReview}</li>
          <li>Identity mismatch: {result.identityMismatch ? 'Yes' : 'No'}</li>
          <li>Patient linked: {result.patientLinked ? 'Yes' : 'No'}</li>
        </Card>
      )
    }
    case 'tool-listDocuments':
      return (
        <Card render={<ul />} className="divide-y px-3">
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
        </Card>
      )
    default:
      return null
  }
}

function CitationLink(props: ComponentProps<typeof defaultComponents.a>) {
  const { numbers, documents, excerpts } = use(CitationContext)
  const citation = parseCitation(props.href)
  const number = props.href && numbers.get(props.href)
  if (!citation || !number) return <defaultComponents.a {...props} />

  const fileName =
    documents.find((document) => document.id === citation.documentId)
      ?.fileName ?? 'Document'
  const excerpt = excerpts.get(pageKey(citation.documentId, citation.page))

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Citation ${number}: ${fileName}, page ${citation.page}`}
        className="mx-0.5 cursor-pointer align-super text-[0.7em] leading-none font-medium tabular-nums text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        [{number}]
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-64">
        <PopoverTitle className="break-all">{fileName}</PopoverTitle>
        <p className="text-muted-foreground">
          {[excerpt?.section, `Page ${citation.page}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {excerpt && <p>{excerpt.text}</p>}
        <Link href={props.href ?? ''} className="text-primary underline">
          Open page
        </Link>
      </PopoverContent>
    </Popover>
  )
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

  const { summary, observations } = result
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
