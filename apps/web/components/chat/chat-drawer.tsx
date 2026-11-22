'use client'

import { useChat } from '@ai-sdk/react'
import type { ChatMessage, PageContext } from '@repo/ai/chat'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/components/drawer'
import { Textarea } from '@repo/ui/components/textarea'
import { DefaultChatTransport } from 'ai'
import { MessageSquare, X } from 'lucide-react'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ChatPart } from '#components/chat/chat-parts'

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

/** Ephemeral, page-scoped clinical assistant mounted beside the theme toggle. */
export function ChatDrawer({
  documents,
}: {
  documents: { id: string; fileName: string }[]
}) {
  const pathname = usePathname()
  const { id } = useParams<{ id?: string }>()
  const context: PageContext =
    pathname.startsWith('/patients/') && id
      ? { page: 'patient', patientId: id }
      : pathname.startsWith('/documents/') && id
        ? { page: 'document', documentId: id }
        : { page: pathname.startsWith('/patients') ? 'patients' : 'documents' }

  const scope =
    context.page === 'document'
      ? `Document · ${documents.find((document) => document.id === context.documentId)?.fileName ?? context.documentId}`
      : context.page === 'patient'
        ? `Patient · ${context.patientId}`
        : context.page === 'patients'
          ? 'All patients'
          : 'All documents'

  return (
    <Drawer swipeDirection="right" modal={false} disablePointerDismissal>
      <DrawerTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open clinical assistant"
          />
        }
      >
        <MessageSquare className="size-4" />
      </DrawerTrigger>
      <DrawerContent
        keepMounted
        className="rounded-none [--drawer-inset:0px] data-[swipe-axis=x]:w-full data-[swipe-axis=x]:sm:w-md"
      >
        <DrawerHeader className="flex-row items-start justify-between border-b">
          <div>
            <DrawerTitle>Clinical assistant</DrawerTitle>
            <DrawerDescription>
              Answers from redacted records. Verify unreviewed values.
            </DrawerDescription>
            <Badge
              variant="secondary"
              className="mt-2 max-w-full whitespace-normal break-all"
            >
              {scope}
            </Badge>
          </div>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close assistant"
              />
            }
          >
            <X />
          </DrawerClose>
        </DrawerHeader>
        <Conversation key={pathname} context={context} />
      </DrawerContent>
    </Drawer>
  )
}

function Conversation({ context }: { context: PageContext }) {
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

  function send(text: string) {
    if (!text.trim() || busy) return

    void sendMessage({ text: text.trim() }, { body: { context } })
    setInput('')
  }

  return (
    <>
      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        role="log"
        aria-label="Conversation"
      >
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Ask about the records on this page.
            </p>
            {presets[context.page].map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal text-left"
                disabled={busy}
                onClick={() => send(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {message.role === 'user' ? 'You' : 'Assistant'}
            </p>
            {message.parts.map((part, index) => (
              <ChatPart
                // biome-ignore lint/suspicious/noArrayIndexKey: Stream parts are append-only and text parts have no IDs.
                key={`${message.id}-${index}`}
                part={part}
                context={context}
                role={message.role}
              />
            ))}
          </article>
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
      <form
        className="space-y-2 border-t p-4"
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
      >
        <Textarea
          aria-label="Message the assistant"
          placeholder="Ask about these records…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          maxLength={8000}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Conversation clears when you leave this page.
          </p>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void stop()
              }}
            >
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()}>
              Send
            </Button>
          )}
        </div>
      </form>
    </>
  )
}
