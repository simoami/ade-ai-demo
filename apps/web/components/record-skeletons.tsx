import { Card } from '@repo/ui/components/card'

const cards = ['documents', 'pages', 'observations', 'review']
const rows = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

/** Reserves the four-card statistics layout while live counts load. */
export function StatsSkeleton() {
  return (
    <div
      aria-label="Loading statistics"
      role="status"
      className="mb-4 grid grid-cols-2 gap-[13px] lg:grid-cols-4"
    >
      {cards.map((card) => (
        <Card key={card} className="min-h-[91px] animate-pulse p-3.5">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-3 h-6 w-12 rounded bg-muted" />
          <div className="mt-2 h-2 w-32 rounded bg-muted" />
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
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-[46px] border-b bg-muted/30" />
      <div className="h-[35px] border-b bg-muted/30" />
      {rows.map((row) => (
        <div
          key={row}
          className="grid h-[65px] grid-cols-6 items-center gap-6 border-b px-[18px]"
        >
          {cards.map((cell) => (
            <div key={cell} className="h-3 animate-pulse rounded bg-muted" />
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
      <div className="mb-5 h-10 animate-pulse rounded bg-muted" />
      <div className="grid h-[75svh] grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="animate-pulse rounded-lg border bg-muted/30" />
        <Card className="animate-pulse" />
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
      <div className="mb-5 h-28 animate-pulse rounded bg-muted/30" />
      <StatsSkeleton />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <TableSkeleton />
        <Card className="mt-6 h-72 animate-pulse" />
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
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </Card>
  )
}
