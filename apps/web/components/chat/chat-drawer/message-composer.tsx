import { Button } from '@repo/ui/components/button'
import { Textarea } from '@repo/ui/components/textarea'
import type { ChangeEvent, FormEvent } from 'react'

// Roughly two pages of typed text: room for a pasted excerpt, short of flooding the model's context.
const MAX_MESSAGE_LENGTH = 8000

/** Message input with Send, or Stop while an answer streams. */
export function MessageComposer({
  value,
  busy,
  onChange,
  onSubmit,
  onStop,
}: {
  value: string
  busy: boolean
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onStop: () => void
}) {
  return (
    <form className="space-y-2 border-t p-4" onSubmit={onSubmit}>
      <Textarea
        aria-label="Message the assistant"
        placeholder="Ask about these records…"
        value={value}
        onChange={onChange}
        disabled={busy}
        maxLength={MAX_MESSAGE_LENGTH}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Conversation clears when you leave this page.
        </p>
        {busy ? (
          <Button type="button" variant="outline" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!value.trim()}>
            Send
          </Button>
        )}
      </div>
    </form>
  )
}
