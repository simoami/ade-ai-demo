type Point = [number, number]

// Gap in pixels between the outlined text and its dashed outline, so the outline never sits on the glyphs.
export const OUTLINE_PADDING = 2

/** Offsets polygon edges outward by `OUTLINE_PADDING` pixels, for either winding. */
export function outsetOutline(points: Point[]): Point[] {
  const vertices = points.filter(([x, y], index) => {
    const previous = points.at(index - 1)

    return previous?.[0] !== x || previous?.[1] !== y
  })

  if (vertices.length < 3) return vertices

  const area = vertices.reduce((sum, [x, y], index) => {
    const next = vertices[(index + 1) % vertices.length]

    return next ? sum + x * next[1] - next[0] * y : sum
  }, 0)

  if (area === 0) return vertices

  const normals = vertices.map(([x, y], index): Point => {
    const next = vertices[(index + 1) % vertices.length]

    if (!next) return [0, 0]

    const dx = next[0] - x
    const dy = next[1] - y
    const length = Math.hypot(dx, dy) * Math.sign(area)

    // Each normal has the padding's length, so moving a vertex along it moves its edges out by the padding.
    return [(dy / length) * OUTLINE_PADDING, (-dx / length) * OUTLINE_PADDING]
  })

  return vertices.map(([x, y], index) => {
    const previous = normals.at(index - 1)
    const next = normals[index]

    if (!previous || !next) return [x, y]

    const divisor =
      1 + (previous[0] * next[0] + previous[1] * next[1]) / OUTLINE_PADDING ** 2

    // Reversing edges have no finite miter intersection.
    if (Math.abs(divisor) < 1e-8) return [x + next[0], y + next[1]]

    return [
      x + (previous[0] + next[0]) / divisor,
      y + (previous[1] + next[1]) / divisor,
    ]
  })
}
