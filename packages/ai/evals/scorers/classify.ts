import type { DocumentClass } from '#stages/classify/classify-document'

const classes: DocumentClass[] = ['clinical', 'consent', 'other']

/** Minimum accuracy and maximum consent summaries naming a ground-truth identifier. */
export const classifyCeilings = { minAccuracy: 1, maxSummaryLeaks: 0 }

/** Accuracy, per-class precision/recall/F1 and their macro F1; a failed case counts as a miss. */
export function scoreClassification(
  rows: { expected: DocumentClass; actual: DocumentClass | null }[]
) {
  const perClass = Object.fromEntries(
    classes.map((documentClass) => {
      const truePositive = rows.filter(
        (row) => row.expected === documentClass && row.actual === documentClass
      ).length
      const predicted = rows.filter(
        (row) => row.actual === documentClass
      ).length
      const actual = rows.filter((row) => row.expected === documentClass).length
      const precision = predicted ? truePositive / predicted : 1
      const recall = actual ? truePositive / actual : 1
      const f1 =
        precision + recall ? (2 * precision * recall) / (precision + recall) : 0
      return [documentClass, { precision, recall, f1, count: actual }]
    })
  ) as Record<
    DocumentClass,
    { precision: number; recall: number; f1: number; count: number }
  >

  return {
    accuracy: rows.length
      ? rows.filter((row) => row.expected === row.actual).length / rows.length
      : 0,
    macroF1:
      classes.reduce(
        (sum, documentClass) => sum + perClass[documentClass].f1,
        0
      ) / classes.length,
    perClass,
  }
}

/** Whether a consent summary repeats any ground-truth identifier text, ignoring case. */
export function summaryLeaksIdentifier(
  summary: string | null,
  identifiers: string[]
) {
  if (!summary) return false
  const text = summary.toLowerCase()
  return identifiers.some(
    (identifier) => identifier.trim() && text.includes(identifier.toLowerCase())
  )
}

/** True when accuracy or summary privacy falls outside the fixed ceilings. */
export function exceedsClassifyCeilings(
  accuracy: number,
  summaryLeaks: number
) {
  return (
    accuracy < classifyCeilings.minAccuracy ||
    summaryLeaks > classifyCeilings.maxSummaryLeaks
  )
}
