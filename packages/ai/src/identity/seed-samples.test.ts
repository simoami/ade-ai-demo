import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { expectedSchema } from '#evals/fixtures/expected'
import {
  fixtureHashes,
  identifierBox,
  sampleId,
  samplePatient,
  sampleRows,
  tiltedRegion,
} from '#scripts/seed-samples'

const key = Buffer.alloc(32, 1).toString('base64')
const root = new URL('../../../../fixtures/synthetic/', import.meta.url)

async function fixture(id: string) {
  return expectedSchema.parse(
    JSON.parse(await readFile(new URL(`${id}/expected.json`, root), 'utf8'))
  )
}

test('derives stable namespaced UUID v5 IDs and separates document and child IDs', () => {
  assert.equal(sampleId('clinical-20'), '981c8ddb-6a4c-5e2a-b667-cf98e800e72c')
  assert.notEqual(sampleId('clinical-20'), sampleId('intake-01'))
  assert.notEqual(sampleId('clinical-20:r1'), sampleId('intake-01:r1'))
  assert.match(
    sampleId('clinical-20:r1'),
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
  )
})

test('tilts masks in letter-page coordinates and encloses every polygon corner', () => {
  const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.05 }
  const unrotated = tiltedRegion(box, 0)
  assert.ok(Math.abs((unrotated.points[0]?.[0] ?? NaN) - box.x) < 1e-10)
  const rotated = tiltedRegion(box, 4)
  assert.notDeepEqual(rotated.points, unrotated.points)
  for (const [x, y] of rotated.points) {
    assert.ok(
      x >= rotated.box.x && x <= rotated.box.x + rotated.box.width + 1e-12
    )
    assert.ok(
      y >= rotated.box.y && y <= rotated.box.y + rotated.box.height + 1e-12
    )
  }
})

test('preserves the birth year while masking the ISO month and day', async () => {
  const data = await fixture('clinical-20')
  const dob = data.pages[0]?.pii.find((span) => span.category === 'dob')
  assert.ok(dob)
  const mask = identifierBox(dob)
  assert.equal(mask.x, dob.box.x + dob.box.width / 2)
  assert.equal(mask.width, dob.box.width / 2 + 0.004)
  assert.throws(
    () => identifierBox({ ...dob, text: '04/12/1978' }),
    /ISO format/
  )
})

test('maps six fixtures to the existing counts, review flags, and figure handling', async () => {
  const cases = [
    ['clinical-20', 'needsReview', 200, 238, 2, 3],
    ['intake-01', 'needsReview', 12, 0, 0, 0],
    ['referral-01', 'extracting', 17, 0, 1, 0],
    ['consent-01', 'reviewed', 10, 0, 0, 0],
    ['radiology-01', 'reviewed', 10, 0, 0, 0],
    ['invoice-01', 'unsupported', 8, 0, 0, 0],
  ] as const
  for (const [id, status, masks, facts, flaggedMasks, flaggedFacts] of cases) {
    const data = await fixture(id)
    const sample = {
      id,
      fileName: `${id}.pdf`,
      documentClass: data.documentClass,
      patientId: null,
      status,
      uploadedAt: '2026-11-19T14:12:00Z',
    }
    const rows = sampleRows(sample, data, key)
    assert.equal(rows.masks.length, masks, id)
    assert.equal(rows.facts.length, facts, id)
    assert.equal(
      rows.masks.filter((mask) => mask.state === 'needsReview').length,
      flaggedMasks,
      id
    )
    assert.equal(
      rows.facts.filter((fact) => fact.reviewStatus === 'flagged').length,
      flaggedFacts,
      id
    )
    assert.equal(new Set(rows.masks.map((mask) => mask.id)).size, masks)
    assert.deepEqual(rows, sampleRows(sample, data, key))
    assert.ok(rows.masks.some((mask) => mask.blockId))
    assert.ok(!JSON.stringify(rows.identifierHashes).includes('Samplewick'))
    if (id === 'intake-01')
      assert.ok(rows.masks.some((mask) => mask.category === 'Patient photo'))
    if (id === 'radiology-01')
      assert.ok(rows.masks.every((mask) => mask.category !== 'medicalImage'))
    if (id === 'referral-01')
      assert.ok(
        rows.masks.some(
          (mask) =>
            mask.category === 'Unidentified face' &&
            mask.state === 'needsReview'
        )
      )
    const early = sampleRows({ ...sample, status: 'reading' }, data, key)
    assert.deepEqual(early.masks, [])
    assert.deepEqual(early.facts, [])
    assert.equal(early.beforeRedaction, true)
  }
})

test('maps patient fixture hashes to their matching documents without retaining raw identifiers', async () => {
  const data = await fixture('clinical-20')
  const patient = samplePatient(data, 'PT-1042', 'Female', key)
  const hashes = fixtureHashes(data, key)
  assert.equal(patient.mrnHash, hashes.mrn)
  assert.equal(patient.firstNameHash, hashes.firstName)
  assert.equal(patient.lastNameHash, hashes.lastName)
  assert.equal(patient.birthDateHash, hashes.birthDate)
  assert.equal(patient.initials, 'BS')
  assert.equal(patient.birthYear, 1978)
  assert.equal(patient.sex, 'Female')
  assert.ok(!JSON.stringify(patient).includes('Samplewick'))
  assert.equal('sex' in hashes, false)
  assert.throws(
    () => samplePatient({ ...data, pages: [] }, 'x', 'Unknown', key),
    /incomplete/
  )
})

test('fails before service calls with a clear list of missing variable names', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/seed-samples.ts', import.meta.url))],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: '',
        BLOB_READ_WRITE_TOKEN: '',
        PATIENT_HASH_KEY: '',
      },
    }
  )
  assert.equal(result.status, 1)
  assert.match(
    result.stdout + result.stderr,
    /Missing required environment variables: DATABASE_URL, BLOB_READ_WRITE_TOKEN, PATIENT_HASH_KEY/
  )
})
