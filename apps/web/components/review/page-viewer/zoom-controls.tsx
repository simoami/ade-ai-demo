import { Button } from '@repo/ui/components/button'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { nextZoomStep } from '#lib/page-zoom'

/** Step zoom buttons around the current zoom level, which resets to 100% when pressed. */
export function ZoomControls({
  zoom,
  onStep,
  onReset,
}: {
  zoom: number
  onStep: (direction: 'in' | 'out') => void
  onReset: () => void
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={nextZoomStep(zoom, 'out') === undefined}
        onClick={() => onStep('out')}
      >
        <ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-12 px-0 text-[10px] tabular-nums"
        aria-label="Reset zoom to 100%"
        onClick={onReset}
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={nextZoomStep(zoom, 'in') === undefined}
        onClick={() => onStep('in')}
      >
        <ZoomIn />
      </Button>
    </>
  )
}
