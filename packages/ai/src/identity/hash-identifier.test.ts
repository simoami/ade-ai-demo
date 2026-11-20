import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { hashIdentifier, readPatientHashKey } from '#identity/hash-identifier'

const key = Buffer.alloc(32, 1).toString('base64')

test('normalizes trimmed case-folded names and punctuation-free uppercase MRNs', () => {
  assert.equal(
    hashIdentifier('firstName', '  BeX ', key),
    hashIdentifier('firstName', 'bex', key)
  )
  assert.equal(
    hashIdentifier('lastName', 'SAMPLEWICK', key),
    hashIdentifier('lastName', 'samplewick', key)
  )
  assert.equal(
    hashIdentifier('mrn', ' fake-7310 ', key),
    hashIdentifier('mrn', 'FAKE7310', key)
  )
  assert.equal(
    hashIdentifier('lastName', 'e\u0301', key),
    hashIdentifier('lastName', 'é', key)
  )
})

test('produces stable keyed base64url HMAC-SHA256 values', () => {
  const expected = createHmac('sha256', Buffer.alloc(32, 1))
    .update('bex')
    .digest('base64url')
  assert.equal(hashIdentifier('firstName', 'Bex', key), expected)
  assert.notEqual(
    hashIdentifier('firstName', 'Bex', Buffer.alloc(32, 2).toString('base64')),
    expected
  )
  assert.notEqual(hashIdentifier('firstName', 'Aven', key), expected)
  assert.match(expected, /^[A-Za-z0-9_-]{43}$/)
})

test('keeps ISO birth dates stable and rejects invalid calendar dates and empty identifiers', () => {
  assert.equal(
    hashIdentifier('birthDate', ' 1978-04-12 ', key),
    hashIdentifier('birthDate', '1978-04-12', key)
  )
  for (const value of ['1978-02-30', '04/12/1978', '', '2025-02-29']) {
    assert.throws(
      () => hashIdentifier('birthDate', value, key),
      /ISO calendar date/
    )
  }
  assert.doesNotThrow(() => hashIdentifier('birthDate', '2024-02-29', key))
  assert.throws(
    () => hashIdentifier('firstName', ' ', key),
    /must not be empty/
  )
  assert.throws(() => hashIdentifier('mrn', '---', key), /must not be empty/)
})

test('rejects missing and malformed keys without exposing values', () => {
  for (const value of [
    '',
    'secret-value',
    Buffer.alloc(31).toString('base64'),
    Buffer.alloc(33).toString('base64'),
  ]) {
    assert.throws(() => readPatientHashKey(value), {
      message: 'PATIENT_HASH_KEY must be base64 encoding of 32 bytes',
    })
  }
})
