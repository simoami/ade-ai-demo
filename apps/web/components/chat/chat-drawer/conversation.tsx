import { useChat } from '@ai-sdk/react'
import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { DefaultChatTransport } from 'ai'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { DocumentRef } from '#lib/page-context'
import { ConversationMessage } from './conversation-message.tsx'
import { MessageComposer } from './message-composer.tsx'
import { SuggestedPrompts } from './suggested-prompts.tsx'

const transport = new DefaultChatTransport<ChatMessage>({ api: '/api/chat' })

const presets = {
  patient: [
    "Show this patient's glucose trend against the reference range.",
    'Which labs are out of range?',
    'Summarize adverse events, with seriousness and dates.',
    "Show this patient's timeline across documents.",
  ],
  document: [
    'What does this document say about the plan or assessment?',
    'What still needs my attention before I can mark this reviewed?',
    'Which labs are out of range?',
  ],
  documents: [
    'Which documents are waiting for review, and why?',
    'Which documents have flagged observations?',
    'Which documents still have unchecked observations?',
  ],
  patients: [
    'Which patients have abnormal labs or serious adverse events?',
    'Show abnormal lab results across patients.',
    'Summarize serious adverse events across patients.',
  ],
}

/** Page-scoped chat log and composer; stops any running answer when unmounted. */
export function Conversation({
  context,
  documents,
}: {
  context: PageContext
  documents: DocumentRef[]
}) {
  const { messages, sendMessage, status, stop, error } = useChat<ChatMessage>({
    transport,
  })
  const [input, setInput] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (messages.length || busy) end.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  useEffect(
    () => () => {
      void stop()
    },
    [stop]
  )

  function handleSend(text: string) {
    if (!text.trim() || busy) return

    void sendMessage({ text: text.trim() }, { body: { context } })
    setInput('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    handleSend(input)
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value)
  }

  function handleStop() {
    void stop()
  }

  return (
    <>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        role="log"
        aria-label="Conversation"
      >
        {messages.length === 0 && (
          <SuggestedPrompts
            prompts={presets[context.page]}
            disabled={busy}
            onSelect={handleSend}
          />
        )}
        {messages.map((message) => (
          <ConversationMessage
            key={message.id}
            message={message}
            context={context}
            documents={documents}
          />
        ))}
        {Boolean(busy) && (
          <p role="status" className="text-muted-foreground">
            {status === 'submitted' ? 'Thinking…' : 'Answering…'}
          </p>
        )}
        {Boolean(error) && (
          <p role="alert">The assistant could not answer. Please try again.</p>
        )}
        <div ref={end} />
      </div>
      <MessageComposer
        value={input}
        busy={busy}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onStop={handleStop}
      />
    </>
  )
}
