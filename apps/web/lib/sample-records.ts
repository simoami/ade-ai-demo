import { sampleData as clinical } from '#lib/sample-clinical-20'
import { sampleData as consent } from '#lib/sample-consent-01'
import { sampleData as intake } from '#lib/sample-intake-01'
import { sampleData as invoice } from '#lib/sample-invoice-01'
import { sampleData as radiology } from '#lib/sample-radiology-01'
import { sampleData as referral } from '#lib/sample-referral-01'

/** A normalized page region: fractions of page width and height. */
export type Box = { x: number; y: number; width: number; height: number }

export type DocumentStatus =
  | 'rendering'
  | 'reading'
  | 'redacting'
  | 'extracting'
  | 'needsReview'
  | 'reviewed'
  | 'discarded'
  | 'unsupported'

export type DocumentSummary = {
  id: string
  fileName: string
  documentClass: 'clinical' | 'consent' | 'other'
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
  birthYear: number
}

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

export type Observation = {
  id: string
  page: number
  kind: 'lab' | 'vital' | 'symptom' | 'adverse-event'
  name: string
  value: string
  unit: string
  date: string
  box: Box
  state: 'extracted' | 'needsReview' | 'accepted' | 'rejected'
}

export type MatchField = 'lastName' | 'firstName' | 'birthDate' | 'mrn' | 'sex'

/** How one document identifier compares with a patient's stored hash. */
export type FieldMatch = 'match' | 'mismatch' | 'absent'

export type ReviewDocument = DocumentSummary & {
  pageImages: string[]
  redactions: Redaction[]
  observations: Observation[]
  patientMatches: Record<string, Record<MatchField, FieldMatch>>
}

export const patients: Patient[] = [
  { id: 'PT-1042', initials: 'BS', sex: 'Female', birthYear: 1978 },
  { id: 'PT-2210', initials: 'AT', sex: 'Male', birthYear: 1978 },
  { id: 'PT-3317', initials: 'CF', sex: 'Female', birthYear: 1978 },
]

export const documents: DocumentSummary[] = [
  {
    id: 'clinical-20',
    fileName: 'clinical-20.pdf',
    documentClass: 'clinical',
    patientId: 'PT-1042',
    pages: 20,
    status: 'needsReview',
    uploadedAt: '2026-11-19T14:12:00Z',
  },
  {
    id: 'intake-01',
    fileName: 'intake-01.png',
    documentClass: 'clinical',
    patientId: null,
    pages: 1,
    status: 'needsReview',
    uploadedAt: '2026-11-19T14:20:00Z',
  },
  {
    id: 'referral-01',
    fileName: 'referral-01.pdf',
    documentClass: 'clinical',
    patientId: null,
    pages: 2,
    status: 'extracting',
    uploadedAt: '2026-11-19T14:21:00Z',
  },
  {
    id: 'consent-01',
    fileName: 'consent-01.pdf',
    documentClass: 'consent',
    patientId: 'PT-1042',
    pages: 1,
    status: 'reviewed',
    uploadedAt: '2026-11-18T10:02:00Z',
  },
  {
    id: 'radiology-01',
    fileName: 'radiology-01.pdf',
    documentClass: 'clinical',
    patientId: 'PT-2210',
    pages: 1,
    status: 'reviewed',
    uploadedAt: '2026-11-17T16:45:00Z',
  },
  {
    id: 'invoice-01',
    fileName: 'invoice-01.pdf',
    documentClass: 'other',
    patientId: null,
    pages: 1,
    status: 'unsupported',
    uploadedAt: '2026-11-17T09:30:00Z',
  },
]

const sampleData: Record<
  string,
  Pick<
    ReviewDocument,
    'pageImages' | 'redactions' | 'observations' | 'patientMatches'
  >
> = {
  'clinical-20': clinical,
  'intake-01': intake,
  'referral-01': referral,
  'consent-01': consent,
  'radiology-01': radiology,
  'invoice-01': invoice,
}

const reviewDocuments: Record<string, ReviewDocument> = Object.fromEntries(
  documents.map((document) => {
    const data = sampleData[document.id]
    if (!data) throw new Error(`Missing review data for ${document.id}`)

    return [document.id, { ...document, ...data }]
  })
)

/** Returns review data for a sample document, including its processing state. */
export function findReviewDocument(id: string): ReviewDocument | undefined {
  return reviewDocuments[id]
}

/** Looks up a sample patient by ID. */
export function findPatient(id: string | null): Patient | undefined {
  return patients.find((patient) => patient.id === id)
}
