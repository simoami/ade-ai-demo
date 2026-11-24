import { Badge } from '@repo/ui/components/badge'
import { Card } from '@repo/ui/components/card'

/** A list under an optional section title with its count. */
export function ItemGroup({
  title,
  count,
  children,
  separateCards,
}: {
  title: string | null
  count: number
  separateCards: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col">
      {title !== null && (
        <h3 className="flex items-center gap-1.5 pb-2 text-[11px] font-semibold tracking-wide text-foreground uppercase">
          {title}
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
        </h3>
      )}
      {separateCards ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        <Card render={<ul />} className="flex flex-col divide-y rounded-md">
          {children}
        </Card>
      )}
    </section>
  )
}
