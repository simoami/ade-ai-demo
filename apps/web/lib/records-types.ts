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

/** Optional clinical details retained alongside the printed observation. */
export type ObservationDetails = {
  referenceRange?: string | null
  rangeLow?: number | null
  rangeHigh?: number | null
  flag?: string | null
  flagNormalized?: 'low' | 'normal' | 'high' | 'abnormal' | null
  startDate?: string | null
  endDate?: string | null
  serious?: boolean | null
  seriousness?: string | null
  outcome?:
    | 'recovered'
    | 'recovering'
    | 'not-recovered'
    | 'fatal'
    | 'unknown'
    | null
  ongoing?: boolean | null
  route?: string | null
  frequency?: string | null
}

/** One clinical observation with a source region and review state. */
export type Observation = {
  id: string
  page: number
  documentId: string
  valueNumeric: number | null
  details: ObservationDetails
  kind:
    | 'lab'
    | 'vital'
    | 'symptom'
    | 'adverse-event'
    | 'medical-history'
    | 'medication'
  name: string
  value: string
  unit: string
  date: string
  box: Box
  points?: [number, number][]
  state: 'extracted' | 'needsReview' | 'accepted' | 'rejected'
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
