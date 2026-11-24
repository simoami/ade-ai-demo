import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

const ROWS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** Reserves patient list rows and demographics. */
export function PatientsSkeleton() {
  return (
    <Card role="status" aria-label="Loading patients" className="divide-y">
      {ROWS.map((row) => (
        <div key={row} className="flex h-14 items-center gap-3 px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-64" />
        </div>
      ))}
    </Card>
  )
}
