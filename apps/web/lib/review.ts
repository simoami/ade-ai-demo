import type {
  FieldMatch,
  MatchField,
  Observation,
  Redaction,
} from './sample-records.ts'

export type MatchStrength = 'strong' | 'partial' | 'none'

/** Applies the patient link rule: MRN, or last name, first name and date of birth, is a strong match. */
export function matchStrength(
  fields: Record<MatchField, FieldMatch>
): MatchStrength {
  const { lastName, firstName, birthDate, mrn } = fields
  if (
    mrn === 'match' ||
    (lastName === 'match' && firstName === 'match' && birthDate === 'match')
  )
    return 'strong'

  return Object.values(fields).includes('match') ? 'partial' : 'none'
}

/** Counts the redactions and observations a reviewer still has to accept or reject. */
export function pendingCount(items: readonly (Redaction | Observation)[]) {
  return items.filter((item) => item.state === 'needsReview').length
}
