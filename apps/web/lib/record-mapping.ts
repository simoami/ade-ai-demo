import type { FieldMatch, MatchField, Observation } from './records-types.ts'

type Hashes = Partial<Record<MatchField, string | null>>

const matchFields = [
  'lastName',
  'firstName',
  'birthDate',
  'mrn',
  'sex',
] as const

/** Compares keyed identifiers without returning their values to the browser. */
export function patientFieldMatches(
  document: Hashes | null,
  patient: Hashes
): Record<MatchField, FieldMatch> {
  return Object.fromEntries(
    matchFields.map((field) => {
      const left = document?.[field]
      const right = patient[field]
      return [
        field,
        !left || !right ? 'absent' : left === right ? 'match' : 'mismatch',
      ]
    })
  ) as Record<MatchField, FieldMatch>
}

/** Maps stored observation review statuses to review states; unchecked extractions need no decision. */
export function observationState(
  reviewStatus: 'confirmed' | 'corrected' | 'rejected' | 'flagged' | 'unchecked'
): Observation['state'] {
  switch (reviewStatus) {
    case 'unchecked':
      return 'extracted'
    case 'flagged':
      return 'needsReview'
    case 'rejected':
      return 'rejected'
    case 'confirmed':
    case 'corrected':
      return 'accepted'
  }
}
