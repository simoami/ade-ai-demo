'use client'

import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileScan,
  Image,
  ListFilter,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useState } from 'react'

const stages = [
  {
    label: 'Upload',
    caption: 'One PDF or up to 30 page images',
    icon: Upload,
  },
  {
    label: 'Render',
    caption: 'Pages become images',
    icon: Image,
  },
  {
    label: 'Read',
    caption: 'OCR finds text, layout and words',
    icon: FileScan,
  },
  {
    label: 'Redact',
    caption: 'Identifiers and patient photos are burned out',
    icon: ShieldCheck,
  },
  {
    label: 'Extract',
    caption: 'Observations and patient link',
    icon: ListFilter,
  },
  {
    label: 'Review',
    caption: 'A person accepts, rejects and signs off',
    icon: ClipboardCheck,
  },
] as const

/** Steps through ingestion stages, describing the selected one below the diagram. */
export function PipelineStages() {
  const [active, setActive] = useState(0)
  const { label, caption } = stages[active] ?? stages[0]

  return (
    <div className="space-y-3">
      <ol
        aria-label="Document ingestion stages"
        className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6"
      >
        {stages.map(({ label, icon: Icon }, index) => (
          <li key={label} className="relative flex">
            <button
              type="button"
              aria-current={index === active ? 'step' : undefined}
              onClick={() => setActive(index)}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 rounded-lg border py-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-popover',
                index === active
                  ? 'border-primary/15 bg-accent text-accent-foreground'
                  : 'border-border bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn('size-4', index === active && 'text-primary')}
              />
              <span className="font-medium">{label}</span>
            </button>
            {index < stages.length - 1 && (
              <ChevronRight
                aria-hidden="true"
                className="absolute top-1/2 -right-3.5 size-3 -translate-y-1/2 text-muted-foreground"
              />
            )}
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous step"
          disabled={active === 0}
          onClick={() => setActive(active - 1)}
        >
          <ChevronLeft />
        </Button>
        <p aria-live="polite" className="flex-1 text-center text-xs">
          <span className="font-medium">
            Step {active + 1}: {label}.
          </span>{' '}
          <span className="text-muted-foreground">{caption}.</span>
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next step"
          disabled={active === stages.length - 1}
          onClick={() => setActive(active + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
