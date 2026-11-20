import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Box,
  createDb,
  documents,
  eq,
  type IdentifierHashes,
  observations,
  patients,
  redactions,
} from '@repo/db'
import { logger } from '@repo/logger'
import sharp from 'sharp'
import { type Expected, expectedSchema } from '#evals/fixtures/expected'
import { hashIdentifier, readPatientHashKey } from '#identity/hash-identifier'
import { renderPdf } from '#stages/render/render-pages'
import { publishRedactedPages } from '#workflows/ingest-document/publish-redacted-pages'

const log = logger.getSubLogger({ name: 'seed-samples' })
const fixtureRoot = fileURLToPath(
  new URL('../../../fixtures/synthetic/', import.meta.url)
)

type Sample = {
  id: string
  fileName: string
  documentClass: 'clinical' | 'consent' | 'other'
  patientId: string | null
  status: NonNullable<typeof documents.$inferInsert.status>
  uploadedAt: string
}

const samples: Sample[] = [
  {
    id: 'clinical-20',
    fileName: 'clinical-20.pdf',
    documentClass: 'clinical',
    patientId: 'PT-1042',
    status: 'needsReview',
    uploadedAt: '2026-11-19T14:12:00Z',
  },
  {
    id: 'intake-01',
    fileName: 'intake-01.png',
    documentClass: 'clinical',
    patientId: null,
    status: 'needsReview',
    uploadedAt: '2026-11-19T14:20:00Z',
  },
  {
    id: 'referral-01',
    fileName: 'referral-01.pdf',
    documentClass: 'clinical',
    patientId: null,
    status: 'extracting',
    uploadedAt: '2026-11-19T14:21:00Z',
  },
  {
    id: 'consent-01',
    fileName: 'consent-01.pdf',
    documentClass: 'consent',
    patientId: 'PT-1042',
    status: 'reviewed',
    uploadedAt: '2026-11-18T10:02:00Z',
  },
  {
    id: 'radiology-01',
    fileName: 'radiology-01.pdf',
    documentClass: 'clinical',
    patientId: 'PT-2210',
    status: 'reviewed',
    uploadedAt: '2026-11-17T16:45:00Z',
  },
  {
    id: 'invoice-01',
    fileName: 'invoice-01.pdf',
    documentClass: 'other',
    patientId: null,
    status: 'unsupported',
    uploadedAt: '2026-11-17T09:30:00Z',
  },
]

const patientSamples = [
  { id: 'PT-1042', fixture: 'clinical-20', sex: 'Female' },
  { id: 'PT-2210', fixture: 'radiology-01', sex: 'Male' },
  { id: 'PT-3317', fixture: 'intake-01', sex: 'Female' },
]

const labels: Record<string, string> = {
  name: 'Name',
  dob: 'Date of birth',
  id: 'Record number',
  facility: 'Facility',
  provider: 'Provider',
  phone: 'Phone',
  address: 'Address',
  email: 'Email',
  ssn: 'Social security number',
}

/** Derives RFC 4122 UUID v5 IDs in the fixed DNS namespace, scoped to this seed. */
export function sampleId(name: string): string {
  const bytes = createHash('sha1')
    .update(Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex'))
    .update(`ade.samples:${name}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Rotates a normalized rectangle clockwise about the letter page's center, matching fixture scans. */
export function tiltedRegion(box: Box, degrees: number) {
  const angle = (degrees * Math.PI) / 180
  const corners: [number, number][] = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ]
  const points: [number, number][] = corners.map(([x, y]) => {
    const dx = (x - 0.5) * 612
    const dy = (y - 0.5) * 792

    return [
      0.5 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / 612,
      0.5 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / 792,
    ]
  })
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)

  return {
    points,
    box: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
  }
}

/** Pads identifier masks horizontally; ISO birth dates retain their leading year and separator. */
export function identifierBox(
  pii: Expected['pages'][number]['pii'][number]
): Box {
  if (pii.category === 'dob') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pii.text))
      throw new Error('Fixture birth date must use ISO format')
    const keep = 5 / pii.text.length

    return {
      ...pii.box,
      x: pii.box.x + pii.box.width * keep,
      width: pii.box.width * (1 - keep) + 0.004,
    }
  }

  return { ...pii.box, x: pii.box.x - 0.004, width: pii.box.width + 0.008 }
}

function identifiers(expected: Expected) {
  const pii = expected.pages[0]?.pii ?? []
  const name = pii
    .find((span) => span.category === 'name')
    ?.text.trim()
    .split(/\s+/)

  return {
    firstName: name?.[0],
    lastName: name?.slice(1).join(' '),
    birthDate: pii.find((span) => span.category === 'dob')?.text,
    mrn: pii.find((span) => span.category === 'id')?.text,
  }
}

/** Maps a fixture's identifying fields to hashes only; sex is absent in these fixture headers. */
export function fixtureHashes(
  expected: Expected,
  key: string
): IdentifierHashes {
  const hashes: IdentifierHashes = {}

  for (const [field, value] of Object.entries(identifiers(expected))) {
    if (value)
      hashes[field as keyof IdentifierHashes] = hashIdentifier(
        field as keyof IdentifierHashes,
        value,
        key
      )
  }

  return hashes
}

/** Maps the three fixture-backed patients to keyed identifiers and limited demographics. */
export function samplePatient(
  expected: Expected,
  id: string,
  sex: string,
  key: string
): typeof patients.$inferInsert {
  const raw = identifiers(expected)
  const hashes = fixtureHashes(expected, key)
  if (!raw.firstName || !raw.lastName || !raw.birthDate)
    throw new Error('Fixture patient identifiers are incomplete')

  return {
    id,
    initials: `${raw.firstName.charAt(0)}${raw.lastName.charAt(0)}`,
    sex,
    birthYear: Number(raw.birthDate.slice(0, 4)),
    mrnHash: hashes.mrn,
    firstNameHash: hashes.firstName,
    lastNameHash: hashes.lastName,
    birthDateHash: hashes.birthDate,
  }
}

/** Builds replay-safe review rows, preserving sample flags, figure masks and extraction status. */
export function sampleRows(sample: Sample, expected: Expected, key: string) {
  const documentId = sampleId(sample.id)
  const masks: (typeof redactions.$inferInsert)[] = []
  const facts: (typeof observations.$inferInsert)[] = []
  const beforeRedaction = ['rendering', 'reading', 'redacting'].includes(
    sample.status ?? ''
  )

  for (const page of beforeRedaction ? [] : expected.pages) {
    const n = page.page + 1

    for (const pii of page.pii) {
      masks.push({
        id: sampleId(`${sample.id}:r${masks.length + 1}`),
        documentId,
        page: n,
        blockId: 'blockId' in pii ? pii.blockId : null,
        category: labels[pii.category] ?? pii.category,
        ...tiltedRegion(identifierBox(pii), page.rotation),
        state:
          sample.id === 'clinical-20' &&
          ['2:address', '5:provider'].includes(`${n}:${pii.category}`)
            ? 'needsReview'
            : ['consent-01', 'radiology-01'].includes(sample.id)
              ? 'accepted'
              : 'applied',
      })
    }

    for (const figure of page.figures) {
      if (figure.redaction === 'keep') continue
      masks.push({
        id: sampleId(`${sample.id}:r${masks.length + 1}`),
        documentId,
        page: n,
        category:
          figure.kind === 'patientPhoto'
            ? 'Patient photo'
            : figure.kind === 'signature'
              ? 'Signature'
              : 'Unidentified face',
        ...tiltedRegion(figure.box, page.rotation),
        state: figure.redaction === 'review' ? 'needsReview' : 'applied',
      })
    }

    if (sample.status === 'extracting') continue
    const blocks = new Map(page.scannedBlocks.map((block) => [block.id, block]))

    for (const observation of expected.observations) {
      const block = blocks.get(observation.blockId)
      if (!block) continue
      facts.push({
        id: sampleId(`${sample.id}:${observation.id}`),
        documentId,
        kind: observation.kind,
        name: observation.name,
        value: observation.value,
        valueNumeric: /^-?\d+(\.\d+)?$/.test(observation.value)
          ? observation.value
          : null,
        unit: observation.unit,
        effectiveDate: observation.effectiveDate,
        dateSource: 'document',
        sourceFormat: observation.sourceFormat,
        source: [{ page: n, blockId: observation.blockId, box: block.box }],
        reviewStatus:
          observation.kind === 'adverse-event' && [1, 4, 9].includes(n)
            ? 'flagged'
            : 'confirmed',
        details: observation.details,
      })
    }
  }

  return {
    masks,
    facts,
    identifierHashes: fixtureHashes(expected, key),
    beforeRedaction,
  }
}

async function loadFixture(id: string) {
  const result = expectedSchema.safeParse(
    JSON.parse(await readFile(join(fixtureRoot, id, 'expected.json'), 'utf8'))
  )
  if (!result.success || result.data.id !== id)
    throw new Error('Invalid synthetic fixture')

  return result.data
}

/** Seeds the six synthetic samples; no network calls occur until explicit invocation and env validation. */
export async function seedSamples() {
  const missing = [
    'DATABASE_URL',
    'BLOB_READ_WRITE_TOKEN',
    'PATIENT_HASH_KEY',
  ].filter((name) => !process.env[name]?.trim())
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  const key = readPatientHashKey()
  const db = createDb()
  const patientRows = []

  for (const patient of patientSamples) {
    const row = samplePatient(
      await loadFixture(patient.fixture),
      patient.id,
      patient.sex,
      key
    )
    await db
      .insert(patients)
      .values(row)
      .onConflictDoUpdate({ target: patients.id, set: row })
    patientRows.push(row)
  }

  for (const sample of samples) {
    const expected = await loadFixture(sample.id)
    const { masks, facts, identifierHashes, beforeRedaction } = sampleRows(
      sample,
      expected,
      key
    )
    const work = await mkdtemp(join(tmpdir(), 'ade-seed-'))

    try {
      const { pages } = await renderPdf(
        join(fixtureRoot, sample.id, 'scanned.pdf'),
        work,
        2
      )
      const pageDimensions = []
      const redactedPages: Buffer[] = []

      for (const { page } of pages) {
        const file = join(work, `${page}.png`)
        const { width, height } = await sharp(file).metadata()
        if (!width || !height)
          throw new Error('Rendered page has no dimensions')
        if (beforeRedaction) {
          pageDimensions.push({ width, height })
          continue
        }
        const polygons = masks
          .filter((mask) => mask.page === page + 1)
          .map(
            ({ points }) =>
              `<polygon points="${points.map(([x, y]) => `${x * width},${y * height}`).join(' ')}" fill="#000"/>`
          )
          .join('')
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}</svg>`
        // Burn masks before resizing so the Blob holds only redacted pixels.
        const { data, info } = await sharp(
          await sharp(file)
            .composite([{ input: Buffer.from(svg) }])
            .png()
            .toBuffer()
        )
          .resize({ width: 1000 })
          .webp({ quality: 70 })
          .toBuffer({ resolveWithObject: true })
        pageDimensions.push({ width: info.width, height: info.height })
        redactedPages.push(data)
      }

      const linkedPatient = patientRows.find(
        (patient) => patient.id === sample.patientId
      )
      const identityMismatch = Boolean(
        linkedPatient &&
          (linkedPatient.mrnHash !== identifierHashes.mrn ||
            linkedPatient.firstNameHash !== identifierHashes.firstName ||
            linkedPatient.lastNameHash !== identifierHashes.lastName ||
            linkedPatient.birthDateHash !== identifierHashes.birthDate)
      )
      const row: typeof documents.$inferInsert = {
        id: sampleId(sample.id),
        patientId: sample.patientId,
        status: sample.status,
        fileName: sample.fileName,
        originalPathname: `fixtures/${sample.id}/scanned.pdf`,
        sex: null,
        documentClass: sample.documentClass,
        identifierHashes,
        identityMismatch,
        pageDimensions,
        runId: null,
        consentSummary: null,
        createdAt: new Date(sample.uploadedAt),
        reviewedAt:
          sample.status === 'reviewed' ? new Date(sample.uploadedAt) : null,
      }
      await db.batch([
        db
          .insert(documents)
          .values(row)
          .onConflictDoUpdate({ target: documents.id, set: row }),
        db.delete(redactions).where(eq(redactions.documentId, row.id)),
        db.delete(observations).where(eq(observations.documentId, row.id)),
        ...(masks.length ? [db.insert(redactions).values(masks)] : []),
        ...(facts.length ? [db.insert(observations).values(facts)] : []),
      ])
      if (redactedPages.length)
        await publishRedactedPages(row.id, redactedPages)
      log.info('Sample seeded', {
        documentId: row.id,
        pages: pages.length,
        redactions: masks.length,
        observations: facts.length,
      })
    } finally {
      await rm(work, { recursive: true, force: true })
    }
  }
}

if (import.meta.main) {
  try {
    await seedSamples()
  } catch (error) {
    // Provider errors can contain request details; only emit known configuration errors.
    const message =
      error instanceof Error &&
      /^(Missing required environment variables:|PATIENT_HASH_KEY must|DATABASE_URL must)/.test(
        error.message
      )
        ? error.message
        : 'Sample seed failed'
    log.error(message)
    process.exitCode = 1
  }
}
