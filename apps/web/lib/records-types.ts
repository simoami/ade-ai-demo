import type { ObservationView } from '@repo/ai/chat'

/** A normalized page region: fractions of page width and height. */
export type Box = { x: number; y: number; width: number; height: number }

/** Processing and review lifecycle shown by the application. */
export type DocumentStatus =
  | 'rendering'
  | 'reading'
  | 'redacting'
  | 'extracting'
  | 'needsReview'
  | 'reviewed'
  | 'discarded'
  | 'unsupported'
  | 'failed'

/** Document metadata used by lists and review headers. */
export type DocumentSummary = {
  id: string
  fileName: string
  documentClass: 'clinical' | 'consent' | 'other' | null
  patientId: string | null
  pages: number
  status: DocumentStatus
  uploadedAt: string
}

/** A patient as stored: keyed identifier hashes are matched, never shown. */
export type Patient = {
  id: string
  initials: string
  sex: 'Female' | 'Male' | 'Unknown'
  birthYear: number | null
}

/** One redacted region and its review decision. */
export type Redaction = {
  id: string
  page: number
  category: string
  /** Bounding box of `points`, for scrolling and hit areas. */
  box: Box
  /** The redacted region's corners, normalized; tilted with the scan. */
  points: [number, number][]
  state: 'applied' | 'needsReview' | 'accepted' | 'rejected'
}

/** One clinical observation with its source region and review state. */
export type Observation = ObservationView & {
  box: Box
  points?: [number, number][]
}

/** Fields used to compare a document with a patient. */
export type MatchField = 'lastName' | 'firstName' | 'birthDate' | 'mrn' | 'sex'

/** How one document identifier compares with a patient's stored hash. */
export type FieldMatch = 'match' | 'mismatch' | 'absent'

/** Non-identifying demographics for creating a patient when none matches. */
export type ProposedPatient = Omit<Patient, 'id'>

/** Review data with safe page URLs and comparison results only. */
export type ReviewDocument = DocumentSummary & {
  pageImages: PageImage[]
  redactions: Redaction[]
  observations: Observation[]
  patientMatches: Record<string, Record<MatchField, FieldMatch>>
  identityMismatch: boolean
  proposedPatient: ProposedPatient | null
}

/** A signed full-image and thumbnail pair with the page's pixel dimensions. */
export type PageImage = {
  src: string
  thumbnail: string
  width: number
  height: number
}
