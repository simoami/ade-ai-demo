import { Skeleton } from '@repo/ui/components/skeleton'
import { StatsSkeleton } from './stats-skeleton.tsx'
import { TableSkeleton } from './table-skeleton.tsx'

/** Reserves the patient profile, statistics and documents/trends columns. */
export function PatientSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading patient profile"
      className="px-[34px] py-[29px]"
    >
      <Skeleton className="mb-5 h-28 bg-muted/30" />
      <StatsSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <TableSkeleton />
        <Skeleton className="mt-6 h-72 rounded-lg border bg-card" />
      </div>
    </div>
  )
}
