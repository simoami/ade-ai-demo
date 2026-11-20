import { createHash } from 'node:crypto'
import { storage } from '@repo/storage'
import sharp from 'sharp'
import { z } from 'zod'
import { blockSchema, boxSchema, wordSchema } from '#stages/ocr/ocr-result'
import type {
  IdentifierSpan,
  PictureFinding,
  RedactionRegion,
} from '#stages/redact/redaction-types'
import {
  decryptArtifact,
  encryptArtifact,
  encryptionKey,
} from './artifact-encryption.ts'
import { replaceRedactions, updateDocument } from './document-store.ts'
import { publishRedactedPages } from './publish-redacted-pages.ts'

const ocrSchema = z
  .array(
    z.object({
      blocks: z.array(blockSchema),
      words: z.array(wordSchema).optional(),
      usage: z.object({ latencyMs: z.number() }),
    })
  )
  .min(1)
  .max(30)

const regionSchema = z.object({
  page: z.number().int().positive(),
  blockId: z.string().nullable(),
  box: boxSchema,
  points: z
    .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
    .min(3),
  category: z.enum([
    'name',
    'dob',
    'id',
    'address',
    'phone',
    'email',
    'ssn',
    'facility',
    'provider',
    'patientPhoto',
    'face',
    'signature',
  ]),
  state: z.enum(['applied', 'needsReview']),
  source: z.enum(['text', 'picture']),
})

const checkpointSchema = z.object({
  pageCount: z.number().int().min(1).max(30),
  spanCount: z.number().int().nonnegative(),
  regions: z.array(regionSchema),
})

type Dependencies = {
  storage: Pick<typeof storage, 'get' | 'put'>
  key: () => Buffer
  detect: (pages: z.infer<typeof ocrSchema>) => Promise<IdentifierSpan[]>
  pictures: (page: {
    pageNumber: number
    image: Uint8Array
    ocr: z.infer<typeof ocrSchema>[number]
  }) => Promise<PictureFinding[]>
  place: (
    page: {
      pageNumber: number
      image: Uint8Array
      width: number
      height: number
      ocr: z.infer<typeof ocrSchema>[number]
    },
    spans: IdentifierSpan[],
    findings: PictureFinding[]
  ) => Promise<RedactionRegion[]>
  burn: (image: Uint8Array, regions: RedactionRegion[]) => Promise<Buffer>
  replace: typeof replaceRedactions
  publish: (documentId: string, pages: Buffer[]) => Promise<number>
  update: typeof updateDocument
}

const defaults: Dependencies = {
  storage,
  key: () => encryptionKey(process.env.DOCUMENT_ENCRYPTION_KEY),
  detect: async (pages) =>
    (await import('#stages/pii/detect-identifiers')).detectIdentifiers(pages),
  pictures: async (page) =>
    (await import('#stages/pii/review-pictures')).reviewPictures(page),
  place: async (page, spans, findings) =>
    (await import('#stages/redact/place-redactions')).placeRedactions(
      page,
      spans,
      findings
    ),
  burn: async (image, regions) =>
    (await import('#stages/redact/burn-redactions')).burnRedactions(
      image,
      regions
    ),
  replace: replaceRedactions,
  publish: publishRedactedPages,
  update: updateDocument,
}

async function read(path: string, deps: Dependencies) {
  const blob = await deps.storage.get(path)
  if (!blob) return null

  return Buffer.from(await new Response(blob.stream).arrayBuffer())
}

async function required(path: string, deps: Dependencies) {
  const bytes = await read(path, deps)
  if (!bytes) throw new Error('Missing redaction artifact')

  return bytes
}

function redactionId(documentId: string, page: number, index: number) {
  // UUID v5 uses the document UUID as namespace and page/index as its name.
  const namespace = Buffer.from(
    z.uuid().parse(documentId).replaceAll('-', ''),
    'hex'
  )
  const bytes = createHash('sha1')
    .update(namespace)
    .update(`${page}:${index}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Burns every candidate and checkpoints encrypted pixels before replay-safe persistence and publication. */
export async function redactDocument(
  documentId: string,
  pageCount: number,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    const key = deps.key()
    const base = `documents/${documentId}/redaction`
    const manifest = `${base}/ready.json.enc`
    await deps.update(documentId, { status: 'redacting' })
    const saved = await read(manifest, deps)
    let checkpoint: z.infer<typeof checkpointSchema>
    const writeEncrypted = async (path: string, bytes: Buffer) => {
      await deps.storage.put(path, encryptArtifact(bytes, key), {
        contentType: 'application/octet-stream',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
    }

    if (saved) {
      checkpoint = checkpointSchema.parse(
        JSON.parse(decryptArtifact(saved, key).toString('utf8'))
      )
    } else {
      const pages = ocrSchema.parse(
        JSON.parse(
          decryptArtifact(
            await required(`documents/${documentId}/ocr.json.enc`, deps),
            key
          ).toString('utf8')
        )
      )
      if (pages.length !== pageCount) throw new Error('OCR page count mismatch')

      const spans = await deps.detect(pages)
      const regions: RedactionRegion[] = []
      for (const [index, ocr] of pages.entries()) {
        const pageNumber = index + 1
        const image = await required(
          `documents/${documentId}/render/${pageNumber}.png`,
          deps
        )
        const { width, height } = await sharp(image).metadata()
        if (!width || !height) throw new Error('Missing page dimensions')

        const findings = ocr.blocks.some((block) => block.kind === 'figure')
          ? await deps.pictures({ pageNumber, image, ocr })
          : []
        const placed = z.array(regionSchema).parse(
          await deps.place(
            { pageNumber, image, width, height, ocr },
            spans.filter((span) => span.page === pageNumber),
            findings
          )
        )
        if (placed.some((region) => region.page !== pageNumber))
          throw new Error('Redaction page mismatch')

        regions.push(...placed)
        await writeEncrypted(
          `${base}/${pageNumber}.png.enc`,
          await deps.burn(image, placed)
        )
      }
      checkpoint = { pageCount, spanCount: spans.length, regions }
      // The manifest commits the complete page set before publication may delete renders.
      await writeEncrypted(manifest, Buffer.from(JSON.stringify(checkpoint)))
    }
    if (
      checkpoint.pageCount !== pageCount ||
      checkpoint.regions.some((region) => region.page > pageCount)
    )
      throw new Error('Redaction checkpoint mismatch')

    const indices = new Map<number, number>()
    await deps.replace(
      documentId,
      checkpoint.regions.map(({ source: _source, ...region }) => {
        const index = indices.get(region.page) ?? 0
        indices.set(region.page, index + 1)
        return {
          ...region,
          documentId,
          id: redactionId(documentId, region.page, index),
        }
      })
    )
    const burned: Buffer[] = []
    for (let page = 1; page <= pageCount; page++) {
      burned.push(
        decryptArtifact(await required(`${base}/${page}.png.enc`, deps), key)
      )
    }
    await deps.publish(documentId, burned)
    await deps.update(documentId, { status: 'needsReview' })
    return {
      pageCount,
      spanCount: checkpoint.spanCount,
      appliedCount: checkpoint.regions.filter(
        (region) => region.state === 'applied'
      ).length,
      needsReviewCount: checkpoint.regions.filter(
        (region) => region.state === 'needsReview'
      ).length,
    }
  } catch {
    await deps.update(documentId, { status: 'failed' })
    throw new Error('Document redaction failed')
  }
}
