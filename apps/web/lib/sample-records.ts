import { observations, redactions } from './sample-clinical-20.ts'

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
  box: Box
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
  { id: 'PT-3317', initials: 'CF', sex: 'Female', birthYear: 1981 },
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
    status: 'redacting',
    uploadedAt: '2026-11-19T14:20:00Z',
  },
  {
    id: 'referral-01',
    fileName: 'referral-01.pdf',
    documentClass: 'clinical',
    patientId: null,
    pages: 2,
    status: 'reading',
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

const reviewDocuments: Record<string, ReviewDocument> = {
  'clinical-20': {
    ...(documents[0] as DocumentSummary),
    pageImages: Array.from(
      { length: 20 },
      (_, index) => `/samples/clinical-20/${index + 1}.webp`
    ),
    redactions,
    observations,
    patientMatches: {
      'PT-1042': {
        lastName: 'match',
        firstName: 'match',
        birthDate: 'match',
        mrn: 'match',
        sex: 'absent',
      },
      'PT-2210': {
        lastName: 'mismatch',
        firstName: 'mismatch',
        birthDate: 'match',
        mrn: 'mismatch',
        sex: 'absent',
      },
      'PT-3317': {
        lastName: 'mismatch',
        firstName: 'mismatch',
        birthDate: 'mismatch',
        mrn: 'mismatch',
        sex: 'absent',
      },
    },
  },
}

/** Returns a document ready for review, if the sample set has one. */
export function findReviewDocument(id: string): ReviewDocument | undefined {
  return reviewDocuments[id]
}

/** Looks up a sample patient by ID. */
export function findPatient(id: string | null): Patient | undefined {
  return patients.find((patient) => patient.id === id)
}
