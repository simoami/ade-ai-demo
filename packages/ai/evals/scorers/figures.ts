import type { ExpectedFigure } from '#evals/fixtures/expected'
import { boxIoU, normalized } from '#evals/scorers/ocr'
import type { Block, Box } from '#stages/ocr/ocr-result'

/** Overlap an output figure needs to count as finding a ground-truth figure. */
const minimumIoU = 0.5

/** Per-page figure counts; output figures are matched one-to-one, best overlap first. */
export function scoreFigures(
  expected: readonly { kind: ExpectedFigure['kind']; box: Box }[],
  output: readonly Block[]
) {
  const found = output.filter((block) => block.kind === 'figure')
  const pairs = expected
    .flatMap((figure, i) =>
      found.map((block, j) => ({ i, j, iou: boxIoU(figure.box, block.box) }))
    )
    .filter((pair) => pair.iou >= minimumIoU)
    .sort((a, b) => b.iou - a.iou)

  const matchedExpected = new Set<number>()
  const matchedOutput = new Set<number>()
  for (const { i, j } of pairs) {
    if (matchedExpected.has(i) || matchedOutput.has(j)) continue
    matchedExpected.add(i)
    matchedOutput.add(j)
  }

  const byKind: Partial<
    Record<ExpectedFigure['kind'], { expected: number; matched: number }>
  > = {}
  expected.forEach((figure, i) => {
    const counts = byKind[figure.kind] ?? { expected: 0, matched: 0 }
    counts.expected++
    counts.matched += Number(matchedExpected.has(i))
    byKind[figure.kind] = counts
  })

  return {
    expected: expected.length,
    output: found.length,
    matched: matchedExpected.size,
    byKind,
  }
}

/** Share of identifiers burned into figures that appear anywhere in the page output; null without any. */
export function burnedInRecall(
  expected: readonly string[],
  output: readonly Block[]
) {
  if (!expected.length) return null

  const text = normalized(
    output.map((block) => block.text).join(' ')
  ).toLowerCase()
  return (
    expected.filter((value) => text.includes(normalized(value).toLowerCase()))
      .length / expected.length
  )
}
