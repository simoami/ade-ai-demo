import type { Block, Box, Word } from '#stages/ocr/ocr-result'

type Observation = { name: string; value: string; valueNumeric: number | null }

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

type Point = [number, number]

function corners(box: Box): Point[] {
  return [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ]
}

function bounds(points: Point[]): Box {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function center(word: Word) {
  return word.box.y + word.box.height / 2
}

/** Locates an observation's complete OCR row or lines, clipped to its cited block. */
export function observationBox(
  block: Block,
  words: Word[] | undefined,
  observation: Observation,
  geometry: { angle: number; aspectRatio: number } = {
    angle: 0,
    aspectRatio: 1,
  }
): Box & { points?: Point[] } {
  const { angle, aspectRatio } = geometry
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const deskew = ([x, y]: Point): Point => [
    x * aspectRatio * cos + y * sin,
    -x * aspectRatio * sin + y * cos,
  ]
  const originalWords = words?.filter((word) => word.blockId === block.id) ?? []
  const blockWords = originalWords.map((word) => ({
    ...word,
    box: bounds(corners(word.box).map(deskew)),
  }))
  if (!blockWords.length) return block.box

  const valueTokens = new Set(
    [observation.value, String(observation.valueNumeric ?? '')]
      .flatMap((value) => [value, ...value.split(/\s+/)])
      .map(normalize)
      .filter(Boolean)
  )
  const allNameTokens = observation.name
    .split(/\s+/)
    .map(normalize)
    .filter(
      (token) =>
        token.length > 1 && !/^(the|of|and|in|on|with|for)$/.test(token)
    )
  const nameTokens = allNameTokens.slice(0, 2)
  const values = blockWords.filter((word) =>
    valueTokens.has(normalize(word.text))
  )
  const names = nameTokens.flatMap((token) =>
    blockWords.filter((word) => normalize(word.text) === token)
  )
  const pairs = values.flatMap((value) =>
    names.map((name) => ({
      words: [value, name],
      sameBand:
        Math.abs(center(value) - center(name)) <=
        Math.min(value.box.height, name.box.height) / 2,
      distance: Math.hypot(
        value.box.x + value.box.width / 2 - name.box.x - name.box.width / 2,
        center(value) - center(name)
      ),
    }))
  )
  pairs.sort(
    (a, b) => Number(b.sameBand) - Number(a.sameBand) || a.distance - b.distance
  )
  const matched =
    pairs[0]?.words ?? (values.length ? values.slice(0, 1) : names.slice(0, 1))
  if (!matched.length) return block.box

  const [value, name] = matched
  const top = Math.min(...matched.map((word) => word.box.y))
  const bottom = Math.max(
    ...matched.map((word) => word.box.y + word.box.height)
  )
  // A label above its value (a field grid rather than a table row) outlines just that label and value;
  // widening to full rows would cover every neighbouring field in the grid.
  const stacked = value && name && !pairs[0]?.sameBand
  const row = stacked
    ? [
        value,
        ...blockWords.filter(
          (word) =>
            Math.abs(center(word) - center(name)) <= name.box.height / 2 &&
            allNameTokens.includes(normalize(word.text))
        ),
      ]
    : blockWords.filter((word) => center(word) >= top && center(word) <= bottom)
  const rectangle = bounds(row.flatMap((word) => corners(word.box)))
  const points = corners(rectangle).map(
    ([x, y]): Point => [
      Math.max(
        block.box.x,
        Math.min(
          block.box.x + block.box.width,
          (x * cos - y * sin) / aspectRatio
        )
      ),
      Math.max(
        block.box.y,
        Math.min(block.box.y + block.box.height, x * sin + y * cos)
      ),
    ]
  )
  const box = bounds(points)

  if (box.width <= 0 || box.height <= 0) return block.box

  return { ...box, points }
}
