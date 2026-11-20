import type {
  DocumentStatus,
  FieldMatch,
  MatchField,
  Observation,
  Redaction,
} from './records-types.ts'

export type MatchStrength = 'strong' | 'partial' | 'none'

/** Selects a decorative icon for pipeline categories and seeded display labels. */
export function redactionIconKind(category: string) {
  switch (category.replace(/\s/g, '').toLowerCase()) {
    case 'name':
    case 'dob':
    case 'dateofbirth':
    case 'id':
    case 'recordnumber':
    case 'address':
    case 'phone':
    case 'email':
    case 'ssn':
    case 'socialsecuritynumber':
    case 'facility':
    case 'provider':
      return 'text'
    case 'patientphoto':
      return 'patientPhoto'
    case 'face':
    case 'unidentifiedface':
      return 'face'
    case 'signature':
      return 'signature'
    default:
      return 'picture'
  }
}

/** Applies the patient link rule: MRN, or last name, first name and date of birth, is a strong match.
 * Sex is not an identifier. Kept identical to the linking rule in packages/ai `stages/demographics/match-patient.ts`. */
export function matchStrength(
  fields: Record<MatchField, FieldMatch>
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

/** Counts the redactions and observations a reviewer still has to accept or reject. */
export function pendingCount(items: readonly (Redaction | Observation)[]) {
  return items.filter((item) => item.state === 'needsReview').length
}

/** Selects editable review, processing, or a completed read-only view from document status. */
export function reviewMode(status: DocumentStatus) {
  switch (status) {
    case 'needsReview':
      return 'review'
    case 'rendering':
    case 'reading':
    case 'redacting':
    case 'extracting':
      return 'processing'
    default:
      return 'read-only'
  }
}

/** Display labels for document pipeline and review status. */
export const documentStatusLabels: Record<DocumentStatus, string> = {
  rendering: 'Rendering',
  reading: 'Reading text',
  redacting: 'Redacting',
  extracting: 'Extracting',
  needsReview: 'Needs review',
  reviewed: 'Reviewed',
  discarded: 'Discarded',
  unsupported: 'Unsupported',
  failed: 'Failed',
}
