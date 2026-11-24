import { Skeleton } from '@repo/ui/components/skeleton'

/** Reserves the page viewer and review panel columns. */
export function ReviewSkeleton() {
  return (
    <div role="status" aria-label="Loading document review" className="p-6">
      <Skeleton className="mb-5 h-10" />
      <div className="grid h-[75svh] grid-cols-[minmax(0,1fr)_360px] gap-5">
        <Skeleton className="rounded-lg border bg-muted/30" />
        <Skeleton className="rounded-lg border bg-card" />
      </div>
    </div>
  )
}
