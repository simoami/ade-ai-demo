type Size = { width: number; height: number }

/** Scales a page to fill the viewport while preserving its real proportions. */
export function getCoverScale(viewport: Size, page: Size) {
  return Math.max(viewport.width / page.width, viewport.height / page.height)
}

/** Standard zoom levels relative to cover: 25% apart below 100%, 50% apart above. */
export const zoomSteps = [0.5, 0.75, 1, 1.5, 2, 2.5, 3]

/** Returns the next standard level beyond the current zoom, or undefined at the limit. */
export function nextZoomStep(zoom: number, direction: 'in' | 'out') {
  return direction === 'in'
    ? zoomSteps.find((step) => step > zoom + 0.005)
    : [...zoomSteps].reverse().find((step) => step < zoom - 0.005)
}
