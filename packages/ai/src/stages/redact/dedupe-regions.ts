import type { RedactionRegion } from './redaction-types.ts'

/** Keeps larger page boxes covering at least 90% of a region; pictures require full coverage by text. */
export function dedupeRegions(regions: RedactionRegion[]): RedactionRegion[] {
  const area = ({ box }: RedactionRegion) => box.width * box.height
  const kept: RedactionRegion[] = []
  for (const region of [...regions].sort(
    (a, b) =>
      area(b) - area(a) ||
      Number(b.source === 'picture') - Number(a.source === 'picture')
  )) {
    const covered = kept.some((other) => {
      if (other.page !== region.page) return false

      const a = region.box
      const b = other.box
      if (region.source === 'picture' && other.source === 'text')
        return (
          b.x <= a.x &&
          b.y <= a.y &&
          b.x + b.width >= a.x + a.width &&
          b.y + b.height >= a.y + a.height
        )

      const width = Math.max(
        0,
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      )
      const height = Math.max(
        0,
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      )
      // Allow floating-point roundoff at the inclusive 90% boundary.
      return (width * height) / area(region) + Number.EPSILON * 4 >= 0.9
    })
    if (!covered) kept.push(region)
  }

  const survivors = new Set(kept)
  return regions.filter((region) => survivors.has(region))
}
