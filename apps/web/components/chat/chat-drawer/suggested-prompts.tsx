import { Button } from '@repo/ui/components/button'

/** Starter questions for an empty conversation. */
export function SuggestedPrompts({
  prompts,
  disabled,
  onSelect,
}: {
  prompts: string[]
  disabled: boolean
  onSelect: (prompt: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        Ask about the records on this page.
      </p>
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          className="h-auto w-full justify-start whitespace-normal text-left"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </Button>
      ))}
    </div>
  )
}
