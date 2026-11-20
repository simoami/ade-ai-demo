import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { ChevronLeft, ChevronRight, Lock, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import type { Box } from '#lib/sample-records'

const zoomSteps = [0.75, 1, 1.25, 1.5]

type Outline = { id: string; box: Box; tone: 'review' | 'selected' }

/** Shows one redacted page with outlines for flagged and selected regions. */
export function PageViewer({
  images,
  page,
  onPage,
  outlines,
}: {
  images: string[]
  page: number
  onPage: (page: number) => void
  outlines: Outline[]
}) {
  const [zoom, setZoom] = useState(1)
  const src = images[page - 1]

  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-muted/60">
      <div className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock className="size-3.5" />
          Redacted copy · read only
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom === zoomSteps[0]}
            onClick={() =>
              setZoom(zoomSteps[zoomSteps.indexOf(zoom) - 1] ?? zoom)
            }
          >
            <ZoomOut />
          </Button>
          <span className="w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom === zoomSteps.at(-1)}
            onClick={() =>
              setZoom(zoomSteps[zoomSteps.indexOf(zoom) + 1] ?? zoom)
            }
          >
            <ZoomIn />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="w-16 text-center tabular-nums">
            {page} of {images.length}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page === images.length}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div
          className="relative mx-auto aspect-[1000/1294] bg-white shadow-sm ring-1 ring-border"
          style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 52}rem` }}
        >
          {src !== undefined && (
            <Image
              src={src}
              alt={`Page ${page}, redacted`}
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          )}
          {outlines.map(({ id, box, tone }) => (
            <span
              key={id}
              className={cn(
                'pointer-events-none absolute rounded-[2px] ring-2 ring-offset-1',
                tone === 'selected' ? 'ring-primary' : 'ring-amber-500'
              )}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
