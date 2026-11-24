import { Skeleton } from '@repo/ui/components/skeleton'

// Ragged widths read as paragraphs; the short ones end a paragraph.
const PAGE_LINES = ['w-full', 'w-11/12', 'w-full', 'w-3/5', 'w-full', 'w-5/6']

/** Letter-sized sheet with a heading and text lines, standing in for a page that is not rendered yet. */
export function PageSkeleton() {
  return (
    <div className="flex aspect-[8.5/11] h-full max-w-full flex-col gap-3 rounded-sm bg-card p-[8%] shadow-sm ring-1 ring-border">
      <Skeleton className="mb-3 h-5 w-2/5" />
      {[...PAGE_LINES, ...PAGE_LINES].map((width, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: The lines are a fixed decorative sequence.
        <Skeleton key={index} className={`h-2.5 ${width}`} />
      ))}
    </div>
  )
}
