import type { Block, Box, Word } from '#stages/ocr/ocr-result'

type Observation = { name: string; value: string; valueNumeric: number | null }

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function center(word: Word) {
  return word.box.y + word.box.height / 2
}

/** Locates an observation's complete OCR row or lines, clipped to its cited block. */
export function observationBox(
  block: Block,
  words: Word[] | undefined,
  observation: Observation
): Box {
  const blockWords = words?.filter((word) => word.blockId === block.id) ?? []
  if (!blockWords.length) return block.box

  const valueTokens = new Set(
    [observation.value, String(observation.valueNumeric ?? '')]
      .flatMap((value) => [value, ...value.split(/\s+/)])
      .map(normalize)
      .filter(Boolean)
  )
  const nameTokens = observation.name
    .split(/\s+/)
    .map(normalize)
    .filter(
      (token) =>
        token.length > 1 && !/^(the|of|and|in|on|with|for)$/.test(token)
    )
    .slice(0, 2)
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

  const top = Math.min(...matched.map((word) => word.box.y))
  const bottom = Math.max(
    ...matched.map((word) => word.box.y + word.box.height)
  )
  const row = blockWords.filter(
    (word) => center(word) >= top && center(word) <= bottom
  )
  const x = Math.max(block.box.x, Math.min(...row.map((word) => word.box.x)))
  const y = Math.max(block.box.y, Math.min(...row.map((word) => word.box.y)))
  const right = Math.min(
    block.box.x + block.box.width,
    Math.max(...row.map((word) => word.box.x + word.box.width))
  )
  const end = Math.min(
    block.box.y + block.box.height,
    Math.max(...row.map((word) => word.box.y + word.box.height))
  )

  return right > x && end > y
    ? { x, y, width: right - x, height: end - y }
    : block.box
}
