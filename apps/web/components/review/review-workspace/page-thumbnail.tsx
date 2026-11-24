import { cn } from '@repo/ui/lib/utils'
import Image from 'next/image'
import type { PageImage } from '#lib/records-types'

/** One page in the rail, marked when it is current or has items needing review. */
export function PageThumbnail({
  image,
  number,
  current,
  flagged,
  onSelect,
}: {
  image: PageImage
  number: number
  current: boolean
  flagged: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Page ${number}`}
      aria-current={current ? 'page' : undefined}
      onClick={onSelect}
      className="relative w-[65px] rounded-md border border-transparent p-1 aria-current:border-primary aria-current:bg-accent flex flex-col items-center gap-1"
    >
      <span
        style={{ aspectRatio: `${image.width}/${image.height}` }}
        className={cn(
          'relative w-full overflow-hidden rounded-sm bg-white ring-1 ring-border',
          current && 'ring-2 ring-primary'
        )}
      >
        <Image src={image.thumbnail} alt="" fill sizes="5rem" unoptimized />
        {flagged ? (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-warning" />
        ) : null}
      </span>
      <span className="text-[8px] text-muted-foreground">Page {number}</span>
    </button>
  )
}
