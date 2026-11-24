import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

const ROWS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** Reserves the document filters, six columns and row heights. */
export function TableSkeleton() {
  return (
    <Card
      render={<section />}
      aria-label="Loading documents"
      role="status"
      className="mt-6 overflow-hidden"
    >
      <div className="h-[74px] border-b p-4">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="h-[46px] border-b bg-muted/30" />
      <div className="h-[35px] border-b bg-muted/30" />
      {ROWS.map((row) => (
        <div
          key={row}
          className="grid h-[65px] grid-cols-6 items-center gap-6 border-b px-[18px]"
        >
          {['documents', 'pages', 'observations', 'review'].map((cell) => (
            <Skeleton key={cell} className="h-3" />
          ))}
        </div>
      ))}
      <div className="h-12" />
    </Card>
  )
}
