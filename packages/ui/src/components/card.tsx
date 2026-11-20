import { cn } from '@repo/ui/lib/utils'
import type * as React from 'react'

/** Shared bordered surface for grouped workspace content. */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'rounded-lg border bg-card text-card-foreground',
        className
      )}
      {...props}
    />
  )
}
