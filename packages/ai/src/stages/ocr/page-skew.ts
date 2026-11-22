import type { Word } from '#stages/ocr/ocr-result'

/** Estimates page rotation in radians from at least three overlapping, same-block neighbor pairs. */
export function pageSkew(
  words: Word[] | undefined,
  aspectRatio: number
): number {
  const angles: number[] = []
  for (const word of words ?? []) {
    if (!word.blockId) continue

    const x = word.box.x + word.box.width / 2
    const y = word.box.y + word.box.height / 2
    const neighbor = words
      ?.filter(
        (other) =>
          other !== word &&
          other.blockId === word.blockId &&
          other.box.x + other.box.width / 2 > x &&
          Math.min(
            word.box.y + word.box.height,
            other.box.y + other.box.height
          ) > Math.max(word.box.y, other.box.y)
      )
      .sort(
        (a, b) =>
          Math.hypot(
            (a.box.x + a.box.width / 2 - x) * aspectRatio,
            a.box.y + a.box.height / 2 - y
          ) -
          Math.hypot(
            (b.box.x + b.box.width / 2 - x) * aspectRatio,
            b.box.y + b.box.height / 2 - y
          )
      )[0]
    if (!neighbor) continue

    const angle = Math.atan2(
      neighbor.box.y + neighbor.box.height / 2 - y,
      (neighbor.box.x + neighbor.box.width / 2 - x) * aspectRatio
    )
    if (Math.abs(angle) <= Math.PI / 18) angles.push(angle)
  }

  if (angles.length < 3) return 0

  angles.sort((a, b) => a - b)
  const middle = Math.floor(angles.length / 2)
  return (
    ((angles[middle] ?? 0) +
      (angles[Math.floor((angles.length - 1) / 2)] ?? 0)) /
    2
  )
}
