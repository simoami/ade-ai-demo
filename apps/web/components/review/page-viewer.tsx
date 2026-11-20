import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { ChevronLeft, ChevronRight, Lock, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { Box, PageImage, Redaction } from '#lib/records-types'
import { outsetOutline } from './page-outline'
import { getPanPosition, hasPanOverflow } from './page-pan'

const zoomSteps = [0.75, 1, 1.25, 1.5, 2, 2.5, 3]

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
  const [canPan, setCanPan] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const scrollRef = useRef<HTMLElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<Parameters<typeof getPanPosition>[0] | null>(null)
  const image = images[page - 1]

  useEffect(() => {
    if (images.length === 0) return

    const area = scrollRef.current
    const content = pageRef.current

    if (!area || !content) return

    const observer = new ResizeObserver(() => {
      setCanPan(hasPanOverflow(area))
      const { width, height } = content.getBoundingClientRect()
      setPageSize({ width, height })
    })
    observer.observe(area)
    observer.observe(content)

    return () => observer.disconnect()
  }, [images.length])

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

      <section
        ref={scrollRef}
        aria-label="Document page"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scroll region must support native keyboard scrolling.
        tabIndex={0}
        className={cn(
          'flex min-h-0 flex-1 items-start overflow-auto px-5 pt-[18px] pb-[22px]',
          dragging
            ? 'cursor-grabbing select-none'
            : canPan
              ? 'cursor-grab'
              : 'cursor-default'
        )}
        onPointerDown={(event) => {
          if (
            event.pointerType === 'touch' ||
            event.button !== 0 ||
            !event.isPrimary ||
            !hasPanOverflow(event.currentTarget) ||
            (event.target instanceof Element &&
              event.target.closest(
                'button, a, input, select, textarea, [role="button"], [contenteditable]:not([contenteditable="false"])'
              ))
          )
            return

          const area = event.currentTarget
          area.setPointerCapture(event.pointerId)
          area.focus({ preventScroll: true })
          panRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: area.scrollLeft,
            top: area.scrollTop,
          }
          setDragging(true)
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          if (!panRef.current) return

          const position = getPanPosition(panRef.current, event)

          if (!position) return

          event.currentTarget.scrollLeft = position.left
          event.currentTarget.scrollTop = position.top
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onLostPointerCapture={() => {
          panRef.current = null
          setDragging(false)
        }}
      >
        <div
          ref={pageRef}
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
              draggable={false}
            />
          )}
          <svg
            viewBox={`0 0 ${pageSize.width || 1} ${pageSize.height || 1}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
          >
            {outlines.map(({ id, box, points, tone }) => {
              const polygon = points ?? [
                [box.x, box.y],
                [box.x + box.width, box.y],
                [box.x + box.width, box.y + box.height],
                [box.x, box.y + box.height],
              ]
              const padded = outsetOutline(
                polygon.map(([x, y]): [number, number] => [
                  x * pageSize.width,
                  y * pageSize.height,
                ])
              )
              const coordinates = padded.map(([x, y]) => `${x},${y}`).join(' ')

              return (
                <g
                  key={id}
                  fill="none"
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                >
                  <polygon
                    points={coordinates}
                    stroke="white"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polygon
                    points={coordinates}
                    stroke="black"
                    strokeDasharray={tone === 'selected' ? '5 5' : '4 6'}
                    vectorEffect="non-scaling-stroke"
                    className="animate-marching-ants motion-reduce:animate-none"
                  />
                </g>
              )
            })}
          </svg>
        </div>
      </section>
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
