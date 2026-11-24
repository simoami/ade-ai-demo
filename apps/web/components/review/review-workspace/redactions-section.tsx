import { Badge } from '@repo/ui/components/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/collapsible'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** Collapsible, initially open section listing redactions under a counted heading. */
export function RedactionsSection({
  count,
  children,
}: {
  count: number
  children: ReactNode
}) {
  return (
    <Collapsible
      defaultOpen
      render={<section />}
      className="flex flex-col gap-3 border-t pt-4"
    >
      {/* The trigger sits inside the heading so the heading keeps its role and the button stays valid HTML. */}
      <h2 className="text-sm font-semibold">
        <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-left">
          <ChevronRight
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
          />
          Redactions
          <Badge variant="secondary" className="ms-auto tabular-nums">
            {count}
          </Badge>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
