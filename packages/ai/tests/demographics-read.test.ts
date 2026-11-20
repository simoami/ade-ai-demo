import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashIdentifier } from '#identity/hash-identifier'
import { models } from '#models'
import {
  hashDemographics,
  readDemographics,
  validateDemographics,
} from '#stages/demographics/read-demographics'
import type { OcrPage } from '#stages/ocr/ocr-result'

const key = Buffer.alloc(32, 1).toString('base64')

const ocr: OcrPage = {
  blocks: [
    {
      id: 'p1-b1',
      kind: 'paragraph',
      text: 'Synthetic header',
      box: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
      continues: null,
    },
  ],
  usage: { latencyMs: 0 },
}

const output = {
  lastName: ' Samplewick ',
  firstName: 'Bex',
  birthDate: '1978-04-12',
  mrn: 'FAKE-7300',
  sex: 'Female',
}

test('trims identifiers and drops null or blank fields', () => {
  assert.deepEqual(validateDemographics(output), {
    lastName: 'Samplewick',
    firstName: 'Bex',
    birthDate: '1978-04-12',
    mrn: 'FAKE-7300',
    sex: 'Female',
  })
  assert.deepEqual(
    validateDemographics({
      lastName: null,
      firstName: '  ',
      birthDate: null,
      mrn: '',
      sex: 'Unknown',
    }),
    { sex: 'Unknown' }
  )
})

test('rejects invalid schemas and non-ISO birth dates without echoing content', () => {
  for (const invalid of [
    { ...output, sex: 'F' },
    { ...output, mrn: 7300 },
    { lastName: 'PRIVATE SENTINEL' },
  ]) {
    assert.throws(() => validateDemographics(invalid), {
      message: 'Invalid demographics schema',
    })
  }
  for (const birthDate of ['04/12/1978', '1978-02-30', '1978']) {
    assert.throws(() => validateDemographics({ ...output, birthDate }), {
      message: 'Invalid demographics birth date',
    })
  }
})

test('hashes only present identifiers with the shared normalization and leaves sex out', () => {
  const hashes = hashDemographics(
    { lastName: 'SAMPLEWICK', mrn: 'fake 7300', sex: 'Female' },
    key
  )
  assert.deepEqual(hashes, {
    lastName: hashIdentifier('lastName', 'samplewick', key),
    mrn: hashIdentifier('mrn', 'FAKE-7300', key),
  })
  assert.ok(
    !Object.values(hashes).some((hash) => /samplewick|7300/i.test(hash))
  )
})

test('rejects a malformed hashing key', () => {
  assert.throws(() => hashDemographics({ mrn: 'FAKE-7300' }, 'secret'), {
    message: 'PATIENT_HASH_KEY must be base64 encoding of 32 bytes',
  })
})

test('reads demographics with one structured call and skips empty documents', async (context) => {
  const call = context.mock.method(models.pipeline, 'doGenerate', async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(output) }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  }))
  assert.deepEqual(
    await readDemographics([{ blocks: [], usage: { latencyMs: 0 } }]),
    { sex: 'Unknown' }
  )
  assert.equal(call.mock.callCount(), 0)
  assert.equal((await readDemographics([ocr])).mrn, 'FAKE-7300')
  assert.equal(call.mock.callCount(), 1)
})

test('sanitizes provider failures', async (context) => {
  context.mock.method(models.pipeline, 'doGenerate', async () => {
    throw new Error('PRIVATE SENTINEL')
  })
  await assert.rejects(readDemographics([ocr]), {
    message: 'Demographics reading failed',
  })
})
