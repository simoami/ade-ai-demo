import { Check, Minus, X } from 'lucide-react'
import type { FieldMatch } from '#lib/records-types'

/** One identifier comparison: matched, unmatched or absent from the document. */
export function FieldResult({ result }: { result: FieldMatch }) {
  if (result === 'match')
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <Check className="size-4" /> Matched
      </span>
    )

  if (result === 'mismatch')
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <X className="size-4" /> Unmatched
      </span>
    )

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-4" /> Not in document
    </span>
  )
}
