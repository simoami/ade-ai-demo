type Size = { width: number; height: number }

/** Scales a page to fill the viewport while preserving its real proportions. */
export function getCoverScale(viewport: Size, page: Size) {
  return Math.max(viewport.width / page.width, viewport.height / page.height)
}
