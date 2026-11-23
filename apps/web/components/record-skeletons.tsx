import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

const cards = ['documents', 'pages', 'observations', 'review']
const rows = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

// Ragged widths read as paragraphs; the short ones end a paragraph.
const PAGE_LINES = ['w-full', 'w-11/12', 'w-full', 'w-3/5', 'w-full', 'w-5/6']

/** Reserves the four-card statistics layout while live counts load. */
export function StatsSkeleton() {
  return (
    <div
      aria-label="Loading statistics"
      role="status"
      className="mb-4 grid grid-cols-2 gap-[13px] lg:grid-cols-4"
    >
      {cards.map((card) => (
        <Card key={card} className="min-h-[91px] p-3.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-12" />
          <Skeleton className="mt-2 h-2 w-32" />
        </Card>
      ))}
    </div>
  )
}

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
      {rows.map((row) => (
        <div
          key={row}
          className="grid h-[65px] grid-cols-6 items-center gap-6 border-b px-[18px]"
        >
          {cards.map((cell) => (
            <Skeleton key={cell} className="h-3" />
          ))}
        </div>
      ))}
      <div className="h-12" />
    </Card>
  )
}

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

/** Reserves patient list rows and demographics. */
export function PatientsSkeleton() {
  return (
    <Card role="status" aria-label="Loading patients" className="divide-y">
      {rows.map((row) => (
        <div key={row} className="flex h-14 items-center gap-3 px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-64" />
        </div>
      ))}
    </Card>
  )
}

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
