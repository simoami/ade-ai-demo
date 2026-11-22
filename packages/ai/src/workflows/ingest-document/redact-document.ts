import sharp from 'sharp'
import { z } from 'zod'
import { boxSchema } from '#stages/ocr/ocr-result'
import type {
  IdentifierSpan,
  PictureFinding,
  RedactionRegion,
} from '#stages/redact/redaction-types'
import { documentScopedId } from './deterministic-id.ts'
import {
  type ArtifactDependencies,
  artifactDefaults,
  type ocrSchema,
  readArtifact,
  readEncrypted,
  readIdentifierSpans,
  readOcr,
  writeEncrypted,
} from './document-artifacts.ts'
import { replaceRedactions, updateDocument } from './document-store.ts'
import { publishRedactedPages } from './publish-redacted-pages.ts'

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

type Dependencies = ArtifactDependencies & {
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
  ...artifactDefaults,
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

/** Burns applied redactions, keeping encrypted unredacted sources for review, and checkpoints pixels before replay-safe persistence and publication. */
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
    let checkpoint: z.infer<typeof checkpointSchema>

    if (await readArtifact(manifest, deps)) {
      checkpoint = checkpointSchema.parse(
        JSON.parse((await readEncrypted(manifest, deps, key)).toString('utf8'))
      )
    } else {
      const pages = await readOcr(documentId, deps)
      if (pages.length !== pageCount) throw new Error('OCR page count mismatch')

      const spans: IdentifierSpan[] = await readIdentifierSpans(
        documentId,
        deps
      )
      const regions: RedactionRegion[] = []
      for (const [index, ocr] of pages.entries()) {
        const pageNumber = index + 1
        const image = await readArtifact(
          `documents/${documentId}/render/${pageNumber}.png`,
          deps
        )
        if (!image) throw new Error('Missing page render')

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
        // Review decisions re-burn from these sources after publication deletes renders.
        await writeEncrypted(
          `${base}/source/${pageNumber}.png.enc`,
          image,
          deps,
          key
        )
        await writeEncrypted(
          `${base}/${pageNumber}.png.enc`,
          await deps.burn(
            image,
            placed.filter(({ state }) => state === 'applied')
          ),
          deps,
          key
        )
      }
      checkpoint = { pageCount, spanCount: spans.length, regions }
      // The manifest commits the complete page set before publication may delete renders.
      await writeEncrypted(
        manifest,
        Buffer.from(JSON.stringify(checkpoint)),
        deps,
        key
      )
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
          id: documentScopedId(documentId, `${region.page}:${index}`),
        }
      })
    )
    const burned: Buffer[] = []
    for (let page = 1; page <= pageCount; page++) {
      burned.push(await readEncrypted(`${base}/${page}.png.enc`, deps, key))
    }
    await deps.publish(documentId, burned)
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
