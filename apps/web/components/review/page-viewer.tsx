import { Button } from '@repo/ui/components/button'
import { ChevronLeft, ChevronRight, Lock, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from 'react-zoom-pan-pinch'
import { getCoverScale, nextZoomStep, zoomSteps } from '#lib/page-zoom'
import type { Box, PageImage, Redaction } from '#lib/records-types'
import { outsetOutline } from './page-outline'

type Outline = {
  id: string
  box: Box
  points?: Redaction['points']
  tone: 'review' | 'selected'
  spotlight: boolean
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
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const image = images[page - 1]
  const cover =
    image && viewport.width > 0 && viewport.height > 0
      ? getCoverScale(viewport, image)
      : 1
  const pageSize = {
    width: (image?.width ?? 1) * cover * zoom,
    height: (image?.height ?? 1) * cover * zoom,
  }

  useEffect(() => {
    if (images.length === 0) return

    const area = viewportRef.current

    if (!area) return

    const observer = new ResizeObserver(() => {
      setViewport({ width: area.clientWidth, height: area.clientHeight })
    })
    observer.observe(area)

    return () => observer.disconnect()
  }, [images.length])

  useEffect(() => {
    if (page > 0 && viewport.width > 0 && viewport.height > 0) {
      void transformRef.current?.centerView(1, 0)
    }
  }, [page, viewport.width, viewport.height])

  function stepZoom(direction: 'in' | 'out') {
    const viewer = transformRef.current

    if (!viewer) return

    const current = viewer.state.scale
    const next = nextZoomStep(current, direction)

    if (next === undefined) return

    void (direction === 'in'
      ? viewer.zoomIn(next - current)
      : viewer.zoomOut(current - next))
  }

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
            disabled={nextZoomStep(zoom, 'out') === undefined}
            onClick={() => stepZoom('out')}
          >
            <ZoomOut />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-12 px-0 text-[10px] tabular-nums"
            aria-label="Reset zoom to 100%"
            onClick={() => void transformRef.current?.centerView(1)}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={nextZoomStep(zoom, 'in') === undefined}
            onClick={() => stepZoom('in')}
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
        ref={viewportRef}
        aria-label="Document page"
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        {image && viewport.width > 0 && viewport.height > 0 && (
          <TransformWrapper
            key={page}
            ref={transformRef}
            initialScale={1}
            minScale={zoomSteps[0]}
            maxScale={zoomSteps.at(-1)}
            centerOnInit
            wheel={{
              activationKeys: (keys) =>
                keys.includes('Control') || keys.includes('Meta'),
            }}
            trackPadPanning={{ disabled: false }}
            keyboard={{ disabled: false }}
            doubleClick={{ mode: 'zoomIn', step: 0.5 }}
            onInit={({ state }) => setZoom(state.scale)}
            onTransform={(_, { scale }) => setZoom(scale)}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              // Content is laid out at the cover size, so the library's scale is the zoom level itself.
              contentStyle={{
                width: image.width * cover,
                height: image.height * cover,
              }}
              wrapperClass="cursor-grab active:cursor-grabbing"
            >
              <div className="relative size-full bg-white shadow-sm ring-1 ring-border">
                <Image
                  src={image.src}
                  alt={`Page ${page}`}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  unoptimized
                  priority
                  draggable={false}
                />
                <svg
                  viewBox={`0 0 ${pageSize.width || 1} ${pageSize.height || 1}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 size-full overflow-visible"
                >
                  {outlines.map(({ id, box, points, tone, spotlight }) => {
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
                    const coordinates = padded
                      .map(([x, y]) => `${x},${y}`)
                      .join(' ')

                    return (
                      <g
                        key={id}
                        fill="none"
                        strokeWidth={1.25}
                        strokeLinejoin="round"
                      >
                        {spotlight === true && (
                          <path
                            d={`M0 0H${pageSize.width}V${pageSize.height}H0Z M${padded.map(([x, y]) => `${x},${y}`).join('L')}Z`}
                            fill="black"
                            fillOpacity={0.18}
                            fillRule="evenodd"
                          />
                        )}
                        <polygon points={coordinates} stroke="white" />
                        <polygon
                          points={coordinates}
                          stroke="black"
                          strokeDasharray={tone === 'selected' ? '5 5' : '4 6'}
                          className="animate-marching-ants motion-reduce:animate-none"
                        />
                      </g>
                    )
                  })}
                </svg>
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
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
