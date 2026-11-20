import type { Box } from '#stages/ocr/ocr-result'

export type IdentifierCategory =
  | 'name'
  | 'dob'
  | 'id'
  | 'address'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'facility'
  | 'provider'

export type PictureKind =
  | 'patientPhoto'
  | 'face'
  | 'signature'
  | 'logo'
  | 'medicalImage'
  | 'clinicalPhoto'
  | 'other'

/** A character range of one OCR block's text that is an identifier; may be part of a token (DOB keeps the year). */
export type IdentifierSpan = {
  page: number
  blockId: string
  start: number
  end: number
  category: IdentifierCategory
  confidence: number
}

/** The picture pass verdict for one figure block, plus identifiers printed inside it (normalized page boxes). */
export type PictureFinding = {
  page: number
  blockId: string
  kind: PictureKind
  decision: 'redact' | 'keep' | 'review'
  confidence: number
  identifiers: { category: IdentifierCategory; box: Box }[]
}

/** A placed redaction: polygon(s) in normalized page coordinates. */
export type RedactionRegion = {
  page: number
  blockId: string | null
  category: IdentifierCategory | 'patientPhoto' | 'face' | 'signature'
  points: [number, number][]
  box: Box
  state: 'applied' | 'needsReview'
  source: 'text' | 'picture'
}
