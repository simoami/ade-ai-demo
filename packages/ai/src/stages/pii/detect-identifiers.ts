import { logger } from '@repo/logger'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { models } from '#models'
import { boxSchema, type OcrPage } from '#stages/ocr/ocr-result'
import type {
  IdentifierSpan,
  PictureFinding,
} from '#stages/redact/redaction-types'
import { buildPagePrompt, identifierPrompt, picturePrompt } from './prompt.ts'

const log = logger.getSubLogger({ name: 'pii' })

const category = z.enum([
  'name',
  'dob',
  'id',
  'address',
  'phone',
  'email',
  'ssn',
  'facility',
  'provider',
])

const confidence = z.number().min(0).max(1)

/** Structured identifier output; semantic offsets are checked against OCR separately. */
export const identifierSchema = z.object({
  spans: z.array(
    z.object({
      blockId: z.string(),
      start: z.number().int().nonnegative(),
      end: z.number().int().positive(),
      category,
      confidence,
    })
  ),
})

/** Structured picture output, including identifiers printed inside kept images. */
export const pictureSchema = z.object({
  findings: z.array(
    z.object({
      blockId: z.string(),
      kind: z.enum([
        'patientPhoto',
        'face',
        'signature',
        'logo',
        'medicalImage',
        'clinicalPhoto',
        'other',
      ]),
      decision: z.enum(['redact', 'keep', 'review']),
      confidence,
      identifiers: z.array(z.object({ category, box: boxSchema })),
    })
  ),
})

/** Validates offsets without exposing text and normalizes overlapping spans per page and block. */
export function validateIdentifierOutput(
  output: unknown,
  ocr: OcrPage,
  page: number
): IdentifierSpan[] {
  const parsed = identifierSchema.safeParse(output)
  if (!parsed.success) throw new Error('Invalid identifier schema')

  const spans = parsed.data.spans.map((span) => {
    const block = ocr.blocks.find(
      (block) => block.id === span.blockId && block.kind !== 'figure'
    )
    if (
      !block ||
      span.start >= span.end ||
      span.end > block.text.length ||
      !block.text.slice(span.start, span.end).trim()
    )
      throw new Error('Invalid identifier offset')

    return { ...span, page }
  })
  const normalized: IdentifierSpan[] = []
  let longest = 0
  for (const span of spans.sort(
    (a, b) =>
      a.blockId.localeCompare(b.blockId) || a.start - b.start || b.end - a.end
  )) {
    const previous = normalized.at(-1)
    if (
      previous &&
      previous.blockId === span.blockId &&
      span.start < previous.end
    ) {
      if (span.end <= previous.end) continue

      const length = span.end - span.start
      if (length > longest) {
        previous.category = span.category
        previous.confidence = span.confidence
        longest = length
      }
      previous.end = span.end
    } else {
      normalized.push({ ...span })
      longest = span.end - span.start
    }
  }

  return normalized
}

/** Requires exactly one policy-consistent verdict for every figure and valid page boxes. */
export function validatePictureOutput(
  output: unknown,
  ocr: OcrPage,
  page: number
): PictureFinding[] {
  const parsed = pictureSchema.safeParse(output)
  if (!parsed.success) throw new Error('Invalid picture schema')

  const figures = ocr.blocks.filter((block) => block.kind === 'figure')
  const seen = new Set<string>()
  if (parsed.data.findings.length !== figures.length)
    throw new Error('Incomplete picture findings')

  return parsed.data.findings.map((finding) => {
    const figure = figures.find((block) => block.id === finding.blockId)
    if (!figure || seen.has(finding.blockId))
      throw new Error('Invalid picture block')
    seen.add(finding.blockId)

    if (
      (finding.kind === 'patientPhoto' || finding.kind === 'signature') &&
      finding.decision !== 'redact'
    )
      throw new Error('Invalid picture policy')
    if (finding.kind === 'face' && finding.decision === 'redact')
      throw new Error('Invalid picture policy')

    if (
      !['patientPhoto', 'signature', 'face'].includes(finding.kind) &&
      finding.decision !== 'keep'
    )
      throw new Error('Invalid picture policy')

    for (const { box } of finding.identifiers) {
      if (
        box.x < figure.box.x ||
        box.y < figure.box.y ||
        box.x + box.width >
          Math.min(1, figure.box.x + figure.box.width) + 1e-6 ||
        box.y + box.height >
          Math.min(1, figure.box.y + figure.box.height) + 1e-6
      )
        throw new Error('Invalid picture identifier box')
    }

    return { ...finding, page }
  })
}

/** Detects direct identifiers per page with validated, end-exclusive block offsets. */
export async function detectIdentifiers(
  pages: OcrPage[]
): Promise<IdentifierSpan[]> {
  const spans: IdentifierSpan[] = []
  for (const [index, ocr] of pages.entries()) {
    if (
      !ocr.blocks.some((block) => block.kind !== 'figure' && block.text.trim())
    )
      continue
    try {
      const result = await generateText({
        model: models.pipeline,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(180_000),
        output: Output.object({ schema: identifierSchema }),
        system: identifierPrompt,
        prompt: buildPagePrompt(index + 1, ocr),
      })
      spans.push(...validateIdentifierOutput(result.output, ocr, index + 1))
    } catch {
      // SDK and schema errors can contain PHI; expose a fixed failure only.
      throw new Error(`Identifier detection failed on page ${index + 1}`)
    }
  }

  log.info(
    { pageCount: pages.length, spanCount: spans.length },
    'Identifier detection completed'
  )
  return spans
}

/** Reviews figure ownership and signatures and locates identifiers inside pictures. */
export async function reviewPictures(page: {
  pageNumber: number
  image: Uint8Array
  ocr: OcrPage
}): Promise<PictureFinding[]> {
  if (!page.ocr.blocks.some((block) => block.kind === 'figure')) return []

  try {
    const result = await generateText({
      model: models.pipeline,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(180_000),
      output: Output.object({ schema: pictureSchema }),
      system: picturePrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: buildPagePrompt(page.pageNumber, page.ocr, true),
            },
            { type: 'file', data: page.image, mediaType: 'image/png' },
          ],
        },
      ],
    })
    const findings = validatePictureOutput(
      result.output,
      page.ocr,
      page.pageNumber
    )
    log.info(
      { page: page.pageNumber, figureCount: findings.length },
      'Picture review completed'
    )
    return findings
  } catch {
    throw new Error(`Picture review failed on page ${page.pageNumber}`)
  }
}
