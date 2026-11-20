import { createHmac } from 'node:crypto'
import { z } from 'zod'

/** Identifier fields compared through keyed hashes; sex remains a limited demographic. */
export type IdentifierField = 'lastName' | 'firstName' | 'birthDate' | 'mrn'

/** Validates a canonical base64-encoded 32-byte patient hashing key without exposing it. */
export function readPatientHashKey(
  value = process.env.PATIENT_HASH_KEY
): string {
  if (
    !value ||
    !/^[A-Za-z0-9+/]{43}=$/.test(value) ||
    Buffer.from(value, 'base64').length !== 32 ||
    Buffer.from(value, 'base64').toString('base64') !== value
  ) {
    throw new Error('PATIENT_HASH_KEY must be base64 encoding of 32 bytes')
  }

  return value
}

/** HMAC-SHA256 of trimmed values: names lowercase, MRNs uppercase alphanumerics, birth dates ISO YYYY-MM-DD. */
export function hashIdentifier(
  field: IdentifierField,
  value: string,
  key: string
): string {
  const secret = Buffer.from(readPatientHashKey(key), 'base64')
  let normalized = value.trim().normalize('NFC')

  if (field === 'mrn')
    normalized = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')
  else if (field === 'birthDate') {
    if (!z.iso.date().safeParse(normalized).success) {
      throw new Error('birthDate must be an ISO calendar date')
    }
  } else normalized = normalized.toLowerCase()

  if (!normalized) throw new Error('Identifier must not be empty')

  return createHmac('sha256', secret).update(normalized).digest('base64url')
}
