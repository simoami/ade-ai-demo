import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

const STATS = ['documents', 'observations', 'review']

/** Reserves the three-card statistics layout while live counts load. */
export function StatsSkeleton() {
  return (
    <div
      aria-label="Loading statistics"
      role="status"
      className="mb-4 grid grid-cols-1 gap-[13px] sm:grid-cols-3"
    >
      {STATS.map((card) => (
        <Card key={card} className="min-h-[91px] p-3.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-12" />
          <Skeleton className="mt-2 h-2 w-32" />
        </Card>
      ))}
    </div>
  )
}
