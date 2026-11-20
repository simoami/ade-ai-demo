import type { DocumentStatus, FieldMatch, MatchField } from './records-types.ts'

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

/** Exposes only redacted page URLs after the document has reached a safe status. */
export function documentPageImages(
  id: string,
  status: DocumentStatus,
  pages: number
): string[] {
  if (
    ![
      'extracting',
      'needsReview',
      'reviewed',
      'discarded',
      'unsupported',
    ].includes(status)
  )
    return []

  return Array.from(
    { length: pages },
    (_, index) => `/api/files/documents/${id}/pages/${index + 1}.webp`
  )
}
