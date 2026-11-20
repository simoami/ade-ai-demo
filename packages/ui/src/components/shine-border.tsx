import { cn } from '@repo/ui/lib/utils'
import type { CSSProperties, ReactNode } from 'react'

/** Frames content with a rotating theme-colored beam and an inherited corner radius. */
export function ShineBorder({
  children,
  className,
  borderWidth = 2,
  duration = 4,
  color = 'var(--color-primary)',
}: {
  children: ReactNode
  className?: string
  borderWidth?: number
  duration?: number
  color?: string
}) {
  return (
    <div
      data-slot="shine-border"
      className={cn('relative overflow-hidden rounded-lg p-(--bw)', className)}
      style={
        {
          '--bw': `${borderWidth}px`,
          '--duration': `${duration}s`,
        } as CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 aspect-square w-[200%] origin-center animate-rotating-beam motion-reduce:animate-none"
          style={{
            background: `conic-gradient(from 90deg, transparent 0%, transparent 60%, ${color} 100%)`,
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-border/50"
        aria-hidden="true"
      />
      <div className="relative h-full rounded-[inherit] bg-card">
        {children}
      </div>
    </div>
  )
}
