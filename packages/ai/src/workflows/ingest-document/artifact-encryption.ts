import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { z } from 'zod'

const keySchema = z
  .base64()
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'Encryption key must contain 32 bytes'
  )

/** Validates the AES-256 key without including its value in errors. */
export function encryptionKey(value: unknown): Buffer {
  const parsed = keySchema.safeParse(value)
  if (!parsed.success) throw new Error('Invalid document encryption key')

  return Buffer.from(parsed.data, 'base64')
}

/** Encrypts an artifact as a 12-byte IV, 16-byte authentication tag, then ciphertext. */
export function encryptArtifact(
  plaintext: Uint8Array,
  key: Uint8Array
): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
}

/** Authenticates the complete artifact before returning any plaintext. */
export function decryptArtifact(artifact: Uint8Array, key: Uint8Array): Buffer {
  if (artifact.length < 28) throw new Error('Invalid encrypted artifact')

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    artifact.subarray(0, 12)
  )
  decipher.setAuthTag(artifact.subarray(12, 28))

  return Buffer.concat([
    decipher.update(artifact.subarray(28)),
    decipher.final(),
  ])
}
