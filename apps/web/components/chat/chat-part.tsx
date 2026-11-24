import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { isToolUIPart } from 'ai'
import { Streamdown } from 'streamdown'
import { ObservationTrend } from '#components/observations/observation-trend'
import { CitationLink } from './chat-part/citation-link.tsx'
import { DocumentListCard } from './chat-part/document-list-card.tsx'
import { ObservationResults } from './chat-part/observation-results.tsx'
import { ReviewStatusCard } from './chat-part/review-status-card.tsx'

const markdownComponents = { a: CitationLink }

/** Renders cited text and the typed clinical tool outputs without raw errors; note searches surface through citation popovers. */
export function ChatPart({
  part,
  context,
  role,
}: {
  part: ChatMessage['parts'][number]
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
    case 'tool-reviewStatus':
      return <ReviewStatusCard result={part.output} />
    case 'tool-listDocuments':
      return <DocumentListCard documents={part.output.documents} />
    default:
      return null
  }
}
