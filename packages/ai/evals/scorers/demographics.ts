import type { IdentifierHashes } from '@repo/db'
import type { IdentifierField } from '#identity/hash-identifier'
import type { MatchStrength } from '#stages/demographics/match-patient'

type PatientMatch = { patientId: string | null; strength: MatchStrength }

const fields: IdentifierField[] = ['lastName', 'firstName', 'birthDate', 'mrn']

/** Minimum per-field accuracy and maximum automatic links to the wrong patient. */
export const demographicsCeilings = {
  minFieldAccuracy: 0.9,
  maxWrongStrongLinks: 0,
}

/** Compares keyed hashes, so values are normalized exactly as linking normalizes them; both absent is correct. */
export function scoreDemographicFields(
  expected: IdentifierHashes,
  actual: IdentifierHashes
): Record<IdentifierField, boolean> {
  return Object.fromEntries(
    fields.map((field) => [field, expected[field] === actual[field]])
  ) as Record<IdentifierField, boolean>
}

/** Share of correct cases per field and over all fields. */
export function fieldAccuracy(rows: Record<IdentifierField, boolean>[]) {
  const accuracy = (field: IdentifierField) =>
    rows.length ? rows.filter((row) => row[field]).length / rows.length : 0
  return {
    ...(Object.fromEntries(
      fields.map((field) => [field, accuracy(field)])
    ) as Record<IdentifierField, number>),
    total: rows.length
      ? fields.reduce((sum, field) => sum + accuracy(field), 0) / fields.length
      : 0,
  }
}

/** An automatic link is wrong when truth is not strong or names another patient. */
export function isWrongStrongLink(
  expected: PatientMatch,
  actual: PatientMatch
) {
  return (
    actual.strength === 'strong' &&
    (expected.strength !== 'strong' || expected.patientId !== actual.patientId)
  )
}

/** True when any field misses its accuracy floor or any automatic link is wrong. */
export function exceedsDemographicsCeilings(
  accuracy: Record<IdentifierField, number>,
  wrongStrongLinks: number
) {
  return (
    fields.some(
      (field) => accuracy[field] < demographicsCeilings.minFieldAccuracy
    ) || wrongStrongLinks > demographicsCeilings.maxWrongStrongLinks
  )
}
