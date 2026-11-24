import { cn } from '@repo/ui/lib/utils'
import { Image, ScanFace, Signature, Type, UserSquare } from 'lucide-react'
import type { ReviewItem } from '#components/review/review-items'

const redactionIcons = {
  text: Type,
  patientPhoto: UserSquare,
  face: ScanFace,
  signature: Signature,
  picture: Image,
}

/** Compact selectable row for a non-clinical item, with trailing actions or decision. */
export function ReviewItemRow({
  item,
  selected,
  onSelect,
  children,
}: {
  item: ReviewItem
  selected: boolean
  onSelect: (item: ReviewItem) => void
  children?: React.ReactNode
}) {
  const Icon = item.redactionIcon && redactionIcons[item.redactionIcon]

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2',
        selected && 'bg-accent'
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(item)}
      >
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : null}
        <span className="flex min-w-0 flex-col items-start">
          <span className="max-w-full truncate text-sm font-medium">
            {item.label}
          </span>
          <span className="max-w-full truncate text-xs text-muted-foreground">
            {item.detail}
          </span>
        </span>
      </button>
      {children}
    </li>
  )
}
