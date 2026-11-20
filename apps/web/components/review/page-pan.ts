type PanOrigin = {
  pointerId: number
  x: number
  y: number
  left: number
  top: number
}

/** Reports whether either scroll axis has overflow to pan. */
export function hasPanOverflow(area: {
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}) {
  return (
    area.scrollWidth > area.clientWidth || area.scrollHeight > area.clientHeight
  )
}

/** Moves scroll offsets opposite the captured pointer's displacement. */
export function getPanPosition(
  origin: PanOrigin,
  pointer: { pointerId: number; clientX: number; clientY: number }
) {
  if (pointer.pointerId !== origin.pointerId) return null

  return {
    left: origin.left + origin.x - pointer.clientX,
    top: origin.top + origin.y - pointer.clientY,
  }
}
