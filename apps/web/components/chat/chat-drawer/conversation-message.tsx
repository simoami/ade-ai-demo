import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { ChatPart } from '#components/chat/chat-part'
import { MessageCitations } from '#components/chat/message-citations'
import type { DocumentRef } from '#lib/page-context'

/** One user bubble or assistant answer, with its parts numbered for citation. */
export function ConversationMessage({
  message,
  context,
  documents,
}: {
  message: ChatMessage
  context: PageContext
  documents: DocumentRef[]
}) {
  return (
    <article
      aria-label={message.role === 'user' ? 'You' : 'Assistant'}
      className={
        message.role === 'user'
          ? 'ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2'
          : 'space-y-2'
      }
    >
      <MessageCitations parts={message.parts} documents={documents}>
        {message.parts.map((part, index) => (
          <ChatPart
            // biome-ignore lint/suspicious/noArrayIndexKey: Stream parts are append-only and text parts have no IDs.
            key={`${message.id}-${index}`}
            part={part}
            context={context}
            role={message.role}
          />
        ))}
      </MessageCitations>
    </article>
  )
}
