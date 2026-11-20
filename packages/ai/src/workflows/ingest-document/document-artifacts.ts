import { storage } from '@repo/storage'
import { z } from 'zod'
import { blockSchema, wordSchema } from '#stages/ocr/ocr-result'
import { identifierSchema } from '#stages/pii/detect-identifiers'
import {
  decryptArtifact,
  encryptArtifact,
  encryptionKey,
} from './artifact-encryption.ts'

/** Validates decrypted OCR before any stage reads it. */
export const ocrSchema = z
  .array(
    z.object({
      blocks: z.array(blockSchema),
      words: z.array(wordSchema).optional(),
      usage: z.object({ latencyMs: z.number() }),
    })
  )
  .min(1)
  .max(30)

const spansSchema = z.array(
  identifierSchema.shape.spans.element.extend({
    page: z.number().int().positive(),
  })
)

/** Encrypted Blob access shared by the steps that read review-only artifacts. */
export type ArtifactDependencies = {
  storage: Pick<typeof storage, 'get' | 'put'>
  key: () => Buffer
}

/** Production Blob storage and the configured AES-256-GCM key. */
export const artifactDefaults: ArtifactDependencies = {
  storage,
  key: () => encryptionKey(process.env.DOCUMENT_ENCRYPTION_KEY),
}

/** Reads one Blob fully, or null when it does not exist. */
export async function readArtifact(
  path: string,
  deps: Pick<ArtifactDependencies, 'storage'>
) {
  const blob = await deps.storage.get(path)
  if (!blob) return null

  return Buffer.from(await new Response(blob.stream).arrayBuffer())
}

/** Reads and decrypts one required artifact. */
export async function readEncrypted(
  path: string,
  deps: ArtifactDependencies,
  key = deps.key()
) {
  const bytes = await readArtifact(path, deps)
  if (!bytes) throw new Error('Missing document artifact')

  return decryptArtifact(bytes, key)
}

/** Encrypts and overwrites one artifact at a deterministic path. */
export async function writeEncrypted(
  path: string,
  bytes: Buffer,
  deps: ArtifactDependencies,
  key = deps.key()
) {
  await deps.storage.put(path, encryptArtifact(bytes, key), {
    contentType: 'application/octet-stream',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/** Decrypts and validates the document's OCR pages. */
export async function readOcr(documentId: string, deps: ArtifactDependencies) {
  return ocrSchema.parse(
    JSON.parse(
      (
        await readEncrypted(`documents/${documentId}/ocr.json.enc`, deps)
      ).toString('utf8')
    )
  )
}

/** Encrypted identifier spans shared by redaction and extraction masking. */
export function identifiersPath(documentId: string) {
  return `documents/${documentId}/identifiers.json.enc`
}

/** Decrypts and validates detected identifier spans. */
export async function readIdentifierSpans(
  documentId: string,
  deps: ArtifactDependencies
) {
  return spansSchema.parse(
    JSON.parse(
      (await readEncrypted(identifiersPath(documentId), deps)).toString('utf8')
    )
  )
}
