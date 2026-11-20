import type {
  IdentifierCategory,
  IdentifierSpan,
  PictureFinding,
} from '#stages/redact/redaction-types'

type Span = Pick<
  IdentifierSpan,
  'page' | 'blockId' | 'start' | 'end' | 'category'
>

/** Counts unique identifier characters by page and block: the total measures what is hidden regardless of label, categories also require the label. */
export function scoreIdentifierCharacters(expected: Span[], actual: Span[]) {
  const categories: IdentifierCategory[] = [
    'name',
    'dob',
    'id',
    'address',
    'phone',
    'email',
    'ssn',
    'facility',
    'provider',
  ]
  const characters = (spans: Span[], category?: IdentifierCategory) => {
    const result = new Set<string>()
    for (const span of spans) {
      if (category && span.category !== category) continue
      for (let offset = span.start; offset < span.end; offset++)
        result.add(
          JSON.stringify([span.page, span.blockId, offset, category ?? ''])
        )
    }
    return result
  }
  const score = (category?: IdentifierCategory) => {
    const truth = characters(expected, category)
    const predicted = characters(actual, category)
    const matched = [...truth].filter((character) =>
      predicted.has(character)
    ).length
    return {
      expected: truth.size,
      predicted: predicted.size,
      matched,
      recall: truth.size ? matched / truth.size : 1,
      precision: predicted.size ? matched / predicted.size : truth.size ? 0 : 1,
    }
  }

  return {
    total: score(),
    categories: categories.map((category) => ({
      category,
      ...score(category),
    })),
  }
}

/** Scores picture decisions by page/block identity, penalizing omissions and extras. */
export function scorePictureDecisions(
  expected: Pick<PictureFinding, 'page' | 'blockId' | 'decision'>[],
  actual: PictureFinding[]
) {
  const matched = expected.filter((truth) =>
    actual.some(
      (finding) =>
        finding.page === truth.page &&
        finding.blockId === truth.blockId &&
        finding.decision === truth.decision
    )
  ).length
  return {
    expected: expected.length,
    predicted: actual.length,
    matched,
    accuracy: Math.max(expected.length, actual.length)
      ? matched / Math.max(expected.length, actual.length)
      : 1,
  }
}

/** Fixed error ceilings prioritize privacy recall over precision on development fixtures. */
export function exceedsPiiCeilings(
  recall: number,
  precision: number,
  pictureAccuracy: number
) {
  return recall < 0.99 || precision < 0.95 || pictureAccuracy < 1
}
