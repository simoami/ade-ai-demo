import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from 'react-zoom-pan-pinch'
import { PageSkeleton } from '#components/record-skeletons/page-skeleton'
import { getCoverScale, nextZoomStep, zoomSteps } from '#lib/page-zoom'
import type { Box, PageImage, Redaction } from '#lib/records-types'
import { outsetOutline } from './page-outline'
import { PageNavigation } from './page-viewer/page-navigation.tsx'
import {
  type OutlineShape,
  PageOutlines,
} from './page-viewer/page-outlines.tsx'
import { PageStatusBar } from './page-viewer/page-status-bar.tsx'
import { ZoomControls } from './page-viewer/zoom-controls.tsx'

// The library clamps the centered position to the page edges.
const SELECTION_ZOOM = 1.5

// Screen pixels kept between a zoomed-to outline and the viewport edge.
const SELECTION_PADDING = 32

const ZOOM_TO_ELEMENT_DURATION = 200

const selectedOutlineId = (id: string) => `page-outline-${id}`

type Outline = {
  id: string
  box: Box
  points?: Redaction['points']
  tone: 'review' | 'selected'
  spotlight?: boolean
}

/** Shows page images at their original proportions with source outlines. */
export function PageViewer({
  images,
  page,
  onPage,
  outlines,
  onDeselect,
}: {
  images: PageImage[]
  page: number
  onPage: (page: number) => void
  outlines: Outline[]
  onDeselect: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLElement>(null)
  const transformRef = useRef<ReactZoomPanPinchRef>(null)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const image = images[page - 1]
  const cover =
    image && viewport.width > 0 && viewport.height > 0
      ? getCoverScale(viewport, image)
      : 1
  // Overlay units stay fixed while zooming, so the library transforms the overlay with the image.
  const pageSize = {
    width: (image?.width ?? 1) * cover,
    height: (image?.height ?? 1) * cover,
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

  const selectedId = outlines.find(({ tone }) => tone === 'selected')?.id

  const shapes = outlines.map(
    ({ id, box, points, tone, spotlight }): OutlineShape => {
      const corners = points ?? [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x + box.width, box.y + box.height],
        [box.x, box.y + box.height],
      ]
      const polygon = outsetOutline(
        corners.map(([x, y]): [number, number] => [
          x * pageSize.width,
          y * pageSize.height,
        ])
      ).map(([x, y]) => `${x},${y}`)

      return {
        id,
        elementId: tone === 'selected' ? selectedOutlineId(id) : undefined,
        tone,
        spotlight,
        polygon,
      }
    }
  )

  // Runs after the page is centered, so a selection elsewhere on the page is brought into view.
  useEffect(() => {
    if (!selectedId || viewport.width === 0 || viewport.height === 0) return

    const transform = transformRef.current
    const outline = document.getElementById(selectedOutlineId(selectedId))
    if (!transform || !outline) return

    // Fit the outline plus a margin on every side, so a wide row never touches the viewport edges;
    // small outlines still stop at 150%. The outline's screen size divided by the current scale is its unscaled size.
    const { scale } = transform.state
    const { width, height } = outline.getBoundingClientRect()
    const fit = Math.min(
      viewport.width / (width / scale + 2 * SELECTION_PADDING),
      viewport.height / (height / scale + 2 * SELECTION_PADDING)
    )
    void transform.zoomToElement(outline.id, {
      scale: Math.min(SELECTION_ZOOM, fit),
      animationTime: ZOOM_TO_ELEMENT_DURATION,
    })
  }, [selectedId, viewport.width, viewport.height])

  useEffect(() => {
    if (!selectedId) return

    const clear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDeselect()
    }

    window.addEventListener('keydown', clear)

    return () => window.removeEventListener('keydown', clear)
  }, [selectedId, onDeselect])

  function handleStepZoom(direction: 'in' | 'out') {
    const viewer = transformRef.current

    if (!viewer) return

    const current = viewer.state.scale
    const next = nextZoomStep(current, direction)

    if (next === undefined) return

    void (direction === 'in'
      ? viewer.zoomIn(next - current)
      : viewer.zoomOut(current - next))
  }

  function handleResetZoom() {
    void transformRef.current?.centerView(1)
  }

  if (images.length === 0) {
    return (
      <section
        role="status"
        aria-label="Preparing document pages"
        className="flex min-h-0 items-center justify-center bg-muted/60 p-6"
      >
        <PageSkeleton />
      </section>
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/60">
      <div className="flex h-[42px] shrink-0 items-center justify-end border-b bg-card px-3.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <ZoomControls
            zoom={zoom}
            onStep={handleStepZoom}
            onReset={handleResetZoom}
          />
          <span className="mx-1 h-4 w-px bg-border" />
          <PageNavigation
            page={page}
            pageCount={images.length}
            onPage={onPage}
          />
        </div>
      </div>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape clears the selection from the keyboard. */}
      <section
        ref={viewportRef}
        aria-label="Document page"
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        onPointerDownCapture={(event) => {
          pressRef.current = { x: event.clientX, y: event.clientY }
        }}
        onClick={(event) => {
          const press = pressRef.current

          if (!selectedId || !press) return
          // A drag pans the page; only a plain click clears the selection.
          if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4)
            return

          const target = document
            .getElementById(selectedOutlineId(selectedId))
            ?.getBoundingClientRect()

          if (
            target &&
            event.clientX >= target.left &&
            event.clientX <= target.right &&
            event.clientY >= target.top &&
            event.clientY <= target.bottom
          )
            return

          onDeselect()
        }}
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
                <PageOutlines
                  width={pageSize.width}
                  height={pageSize.height}
                  shapes={shapes}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </section>
      <PageStatusBar page={page} pageCount={images.length} />
    </section>
  )
}
