import type { IdentifierHashes } from '@repo/db'
import type { IdentifierField } from '#identity/hash-identifier'

/** How one document identifier compares with a patient's stored hash. */
export type FieldMatch = 'match' | 'mismatch' | 'absent'

/** Strong links automatically, partial links with an identity mismatch, none proposes a new patient. */
export type MatchStrength = 'strong' | 'partial' | 'none'

/** A stored patient's keyed identifier hashes and plain sex, as in the patients table. */
export type PatientHashes = {
  id: string
  lastNameHash: string | null
  firstNameHash: string | null
  birthDateHash: string | null
  mrnHash: string | null
  sex: string
}

const strengthScore: Record<MatchStrength, number> = {
  none: 0,
  partial: 100,
  strong: 200,
}

/** Applies the patient link rule: MRN, or last name, first name and date of birth, is a strong match. */
export function matchStrength(
  fields: Record<IdentifierField, FieldMatch>
): MatchStrength {
  const { lastName, firstName, birthDate, mrn } = fields
  if (
    mrn === 'match' ||
    (lastName === 'match' && firstName === 'match' && birthDate === 'match')
  )
    return 'strong'

  return [lastName, firstName, birthDate, mrn].includes('match')
    ? 'partial'
    : 'none'
}

/** Picks the strongest candidate, then the most matching identifiers, then matching sex; earlier patients win ties. */
export function matchPatient(
  document: { hashes: IdentifierHashes; sex: string | null },
  patients: PatientHashes[]
): { patientId: string | null; strength: MatchStrength } {
  let best: { patientId: string | null; strength: MatchStrength } = {
    patientId: null,
    strength: 'none',
  }
  let bestScore = 0

  for (const patient of patients) {
    const fields = {
      lastName: compare(document.hashes.lastName, patient.lastNameHash),
      firstName: compare(document.hashes.firstName, patient.firstNameHash),
      birthDate: compare(document.hashes.birthDate, patient.birthDateHash),
      mrn: compare(document.hashes.mrn, patient.mrnHash),
    }
    const strength = matchStrength(fields)
    const score =
      strengthScore[strength] +
      10 * Object.values(fields).filter((field) => field === 'match').length +
      (document.sex === patient.sex ? 1 : 0)
    if (strength !== 'none' && score > bestScore) {
      best = { patientId: patient.id, strength }
      bestScore = score
    }
  }

  return best
}

function compare(left: string | undefined, right: string | null): FieldMatch {
  if (!left || !right) return 'absent'
  return left === right ? 'match' : 'mismatch'
}
