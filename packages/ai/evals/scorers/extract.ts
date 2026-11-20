import type { Expected } from '#evals/fixtures/expected'
import type { ExtractedObservation } from '#stages/extract/extract-observations'

type Truth = Expected['observations'][number]

type Actual = Pick<
  ExtractedObservation,
  'name' | 'value' | 'unit' | 'effectiveDate' | 'sourceFormat'
>

const formatRank = { table: 0, list: 1, narrative: 2 }

const normalize = (text: string | null) =>
  (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

const key = (observation: Truth | Actual) =>
  [
    normalize(observation.name),
    normalize(observation.value),
    observation.effectiveDate ?? '',
  ].join('|')

/** Ground truth after deduplication: per duplicate group, the first observation in the preferred source format. */
export function keptObservations(expected: Truth[]) {
  const kept = new Map<string, Truth>()
  for (const observation of expected) {
    const current = kept.get(observation.duplicateGroup)
    if (
      !current ||
      formatRank[observation.sourceFormat] < formatRank[current.sourceFormat]
    )
      kept.set(observation.duplicateGroup, observation)
  }
  return [...kept.values()]
}

/** Scores deduplicated output per document, summed over documents: one-to-one matches on name, value and date, units among matches, and one preferred survivor per duplicate group. */
export function scoreObservations(
  documents: { expected: Truth[]; actual: Actual[] }[]
) {
  let expected = 0
  let predicted = 0
  let matched = 0
  let unitMatched = 0
  let groupsCorrect = 0

  for (const document of documents) {
    const kept = keptObservations(document.expected)
    const unused = [...document.actual]
    expected += kept.length
    predicted += document.actual.length

    for (const truth of kept) {
      const index = unused.findIndex((actual) => key(actual) === key(truth))
      const actual = unused[index]
      if (actual) {
        unused.splice(index, 1)
        matched++
        if (normalize(actual.unit) === normalize(truth.unit)) unitMatched++
      }

      const survivors = document.actual.filter(
        (actual) =>
          normalize(actual.name) === normalize(truth.name) &&
          actual.effectiveDate === truth.effectiveDate
      )
      if (
        survivors.length === 1 &&
        survivors[0]?.sourceFormat === truth.sourceFormat
      )
        groupsCorrect++
    }
  }

  return {
    expected,
    predicted,
    matched,
    recall: expected ? matched / expected : 1,
    precision: predicted ? matched / predicted : expected ? 0 : 1,
    unitAccuracy: matched ? unitMatched / matched : null,
    dedupeAccuracy: expected ? groupsCorrect / expected : 1,
  }
}

/** Fixed error ceilings on development fixtures; see docs/evals.md for the reasons. */
export function exceedsExtractionCeilings(
  score: ReturnType<typeof scoreObservations>
) {
  return (
    score.recall < 0.95 ||
    score.precision < 0.95 ||
    (score.unitAccuracy ?? 0) < 0.98 ||
    score.dedupeAccuracy < 0.95
  )
}
