import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { ChevronLeft, ChevronRight, Lock, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import type { Box, PageImage, Redaction } from '#lib/records-types'

const zoomSteps = [0.75, 1, 1.25, 1.5]

type Outline = {
  id: string
  box: Box
  points?: Redaction['points']
  tone: 'review' | 'selected'
}

/** Shows page images at their original proportions with source outlines. */
export function PageViewer({
  images,
  page,
  onPage,
  outlines,
}: {
  images: PageImage[]
  page: number
  onPage: (page: number) => void
  outlines: Outline[]
}) {
  const [zoom, setZoom] = useState(1)
  const image = images[page - 1]

  if (images.length === 0) {
    return (
      <section
        className="flex min-h-0 flex-col items-center justify-center gap-3 bg-muted/60 p-6 text-muted-foreground"
        aria-label="Document viewer"
      >
        <p className="text-xs" role="status">
          No pages available
        </p>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/60">
      <div className="flex h-[42px] shrink-0 items-center justify-end border-b bg-card px-3.5 text-[10px] text-muted-foreground">
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

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto px-5 pt-[18px] pb-[22px]">
        <div
          className="shrink-0 relative mx-auto bg-white shadow-sm ring-1 ring-border"
          style={{
            width: `${zoom * 100}%`,
            maxWidth: `${zoom * 430}px`,
            aspectRatio: image ? `${image.width}/${image.height}` : undefined,
          }}
        >
          {image !== undefined && (
            <Image
              src={image.src}
              alt={`Page ${page}`}
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              unoptimized
              priority
            />
          )}
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
          >
            {outlines.map(({ id, box, points, tone }) => {
              const attributes = {
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeDasharray: '5 5',
                vectorEffect: 'non-scaling-stroke' as const,
                className: cn(
                  'animate-marching-ants motion-reduce:animate-none',
                  tone === 'selected' ? 'text-primary' : 'text-warning'
                ),
              }

              return points ? (
                <polygon
                  key={id}
                  points={points.map(([x, y]) => `${x},${y}`).join(' ')}
                  {...attributes}
                />
              ) : (
                <rect
                  key={id}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  {...attributes}
                />
              )
            })}
          </svg>
        </div>
      </div>
      <div className="flex h-[29px] shrink-0 items-center justify-between border-t bg-card/50 px-3 text-[8.5px] text-muted-foreground [&_span]:flex [&_span]:items-center [&_span]:gap-1">
        <span>
          <Lock size={13} />
          Read only
        </span>
        <span>
          Page {page} of {images.length}
        </span>
      </div>
    </section>
  )
}
