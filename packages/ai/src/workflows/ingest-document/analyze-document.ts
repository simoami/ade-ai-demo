import type { ProposedPatient } from '@repo/db'
import { readPatientHashKey } from '#identity/hash-identifier'
import type { Classification } from '#stages/classify/classify-document'
import { matchPatient } from '#stages/demographics/match-patient'
import {
  type Demographics,
  hashDemographics,
  readDemographics,
} from '#stages/demographics/read-demographics'
import type { OcrPage } from '#stages/ocr/ocr-result'
import { detectIdentifiers } from '#stages/pii/detect-identifiers'
import type { IdentifierSpan } from '#stages/redact/redaction-types'
import {
  type ArtifactDependencies,
  artifactDefaults,
  identifiersPath,
  readArtifact,
  readIdentifierSpans,
  readOcr,
  writeEncrypted,
} from './document-artifacts.ts'
import { findPatientCandidates, updateDocument } from './document-store.ts'

type Dependencies = ArtifactDependencies & {
  update: typeof updateDocument
  classify: (pages: OcrPage[]) => Promise<Classification>
  readDemographics: (pages: OcrPage[]) => Promise<Demographics>
  findPatients: typeof findPatientCandidates
  match: typeof matchPatient
  detect: (pages: OcrPage[]) => Promise<IdentifierSpan[]>
  hashKey: () => string
  now: () => Date
}

const defaults: Dependencies = {
  ...artifactDefaults,
  update: updateDocument,
  classify: async (pages) =>
    (await import('#stages/classify/classify-document')).classifyDocument(
      pages
    ),
  readDemographics,
  findPatients: findPatientCandidates,
  match: matchPatient,
  detect: detectIdentifiers,
  hashKey: () => readPatientHashKey(),
  now: () => new Date(),
}

/** Classifies the document and persists its class and consent summary; returns no document text. */
export async function classifyStoredDocument(
  documentId: string,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    const { documentClass, consentSummary, confidence } = await deps.classify(
      await readOcr(documentId, deps)
    )
    await deps.update(documentId, {
      documentClass,
      consentSummary: documentClass === 'consent' ? consentSummary : null,
    })

    return { documentClass, confidence }
  } catch {
    throw new Error('Document classification failed')
  }
}

/** Initials and birth year for creating a patient; ages 90 and over keep no birth year (ADR 0002). */
export function proposePatient(
  demographics: Demographics,
  now: Date
): ProposedPatient | null {
  const initials = [demographics.firstName, demographics.lastName]
    .map((name) => name?.trim().charAt(0).toUpperCase() ?? '')
    .join('')
  if (!initials) return null

  let birthYear: number | null = null
  if (demographics.birthDate) {
    const [year = 0, month = 0, day = 0] = demographics.birthDate
      .split('-')
      .map(Number)
    const beforeBirthday =
      now.getUTCMonth() + 1 < month ||
      (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)
    const age = now.getUTCFullYear() - year - (beforeBirthday ? 1 : 0)
    birthYear = age >= 90 ? null : year
  }

  return { initials, birthYear, sex: demographics.sex ?? 'Unknown' }
}

/** Reads identifiers, hashes them inside the step and links a matching patient; only the match strength leaves. */
export async function identifyDocumentPatient(
  documentId: string,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    const demographics = await deps.readDemographics(
      await readOcr(documentId, deps)
    )
    const hashes = hashDemographics(demographics, deps.hashKey())

    const sex = demographics.sex ?? null
    const { patientId, strength } = deps.match(
      { hashes, sex },
      await deps.findPatients(hashes)
    )
    await deps.update(documentId, {
      identifierHashes: hashes,
      sex,
      patientId,
      identityMismatch: strength === 'partial',
      proposedPatient: proposePatient(demographics, deps.now()),
    })

    return { strength }
  } catch {
    throw new Error('Document patient matching failed')
  }
}

/** Detects identifier spans once and stores them encrypted for redaction and extraction masking. */
export async function detectDocumentIdentifiers(
  documentId: string,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    const key = deps.key()
    const path = identifiersPath(documentId)
    // A stored artifact means a previous attempt finished detection; reuse it rather than pay for the model again.
    if (await readArtifact(path, deps))
      return { spanCount: (await readIdentifierSpans(documentId, deps)).length }

    const spans = await deps.detect(await readOcr(documentId, deps))
    await writeEncrypted(path, Buffer.from(JSON.stringify(spans)), deps, key)

    return { spanCount: spans.length }
  } catch {
    throw new Error('Document identifier detection failed')
  }
}
