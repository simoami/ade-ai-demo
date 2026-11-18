import type { Block, Box } from '#stages/ocr/ocr-result'

function distance(a: readonly string[], b: readonly string[]) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 0; i < a.length; i++) {
    const current = [i + 1]
    for (let j = 0; j < b.length; j++) {
      current.push(
        Math.min(
          (current[j] ?? 0) + 1,
          (previous[j + 1] ?? 0) + 1,
          (previous[j] ?? 0) + (a[i] === b[j] ? 0 : 1)
        )
      )
    }
    previous = current
  }

  return previous[b.length] ?? 0
}

/** NFC text with whitespace runs collapsed to single spaces. */
export function normalized(text: string) {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** Whitespace-normalized character edit rate; insertions can exceed one. */
export function characterErrorRate(expected: string, actual: string) {
  const reference = Array.from(normalized(expected))
  return (
    distance(reference, Array.from(normalized(actual))) /
    Math.max(1, reference.length)
  )
}

/** Whitespace-tokenized word edit rate, retaining case and punctuation. */
export function wordErrorRate(expected: string, actual: string) {
  const reference = normalized(expected).split(' ').filter(Boolean)
  return (
    distance(reference, normalized(actual).split(' ').filter(Boolean)) /
    Math.max(1, reference.length)
  )
}

/** Intersection over union for two normalized rectangles. */
export function boxIoU(a: Box, b: Box) {
  const intersection =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return intersection / (a.width * a.height + b.width * b.height - intersection)
}

/** Aligns reading-order blocks by text similarity, penalizing missing and extra blocks. */
export function scoreBlocks(
  expected: readonly Block[],
  actual: readonly Block[]
) {
  const costs = Array.from({ length: expected.length + 1 }, () =>
    Array<number>(actual.length + 1).fill(0)
  )
  const get = (i: number, j: number) => costs[i]?.[j] ?? 0
  const set = (i: number, j: number, value: number) => {
    const row = costs[i]
    if (row) row[j] = value
  }

  for (let i = 0; i <= expected.length; i++) set(i, 0, i)
  for (let j = 0; j <= actual.length; j++) set(0, j, j)

  const substitution = (i: number, j: number) =>
    Math.min(
      1,
      characterErrorRate(expected[i]?.text ?? '', actual[j]?.text ?? '')
    )

  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= actual.length; j++)
      set(
        i,
        j,
        Math.min(
          get(i - 1, j) + 1,
          get(i, j - 1) + 1,
          get(i - 1, j - 1) + substitution(i - 1, j - 1)
        )
      )
  }

  let i = expected.length
  let j = actual.length
  let kinds = 0
  let boxes = 0
  let slots = 0
  while (i > 0 || j > 0) {
    slots++
    if (
      i > 0 &&
      j > 0 &&
      Math.abs(get(i, j) - get(i - 1, j - 1) - substitution(i - 1, j - 1)) <
        1e-8
    ) {
      const a = expected[--i]
      const b = actual[--j]
      if (a && b) {
        kinds += Number(a.kind === b.kind)
        boxes += boxIoU(a.box, b.box)
      }
    } else if (i > 0 && (j === 0 || get(i, j) === get(i - 1, j) + 1)) i--
    else j--
  }

  const reference = expected.map((block) => block.text).join('\n')
  const output = actual.map((block) => block.text).join('\n')
  return {
    cer: characterErrorRate(reference, output),
    wer: wordErrorRate(reference, output),
    blockKindAccuracy: slots ? kinds / slots : 1,
    boxIoU: slots ? boxes / slots : 1,
  }
}

/** Page-mean CER and WER ceilings per PDF variant; rationale in docs/evals.md. */
export const ocrCeilings = {
  clean: { cer: 0.01, wer: 0.03 },
  scanned: { cer: 0.03, wer: 0.09 },
} as const

/** Returns variants whose page-mean CER or WER is nonfinite or above its ceiling. */
export function exceededOcrCeilings(
  pages: readonly {
    variant: keyof typeof ocrCeilings
    cer: number
    wer: number
  }[]
) {
  return (['clean', 'scanned'] as const).filter((variant) => {
    const subset = pages.filter((page) => page.variant === variant)
    return (['cer', 'wer'] as const).some(
      (metric) =>
        subset.length > 0 &&
        !(
          subset.reduce((sum, page) => sum + page[metric], 0) / subset.length <=
          ocrCeilings[variant][metric]
        )
    )
  })
}
