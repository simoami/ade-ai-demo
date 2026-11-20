import { logger } from '@repo/logger'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { models } from '#models'
import type { OcrPage } from '#stages/ocr/ocr-result'
import { dedupeObservations } from './dedupe-observations.ts'
import { type MaskedSpans, maskIdentifiers } from './mask-identifiers.ts'
import { buildExtractionPrompt, extractionPrompt } from './prompt.ts'

const log = logger.getSubLogger({ name: 'extract' })

const isoDate = z.iso.date()

/** Structured extraction output; strict model schemas need every key, so absent values are null. */
export const observationOutputSchema = z.object({
  observations: z.array(
    z.object({
      blockId: z.string(),
      kind: z.enum(['lab', 'vital', 'symptom', 'adverse-event']),
      name: z.string().trim().min(1),
      value: z.string().trim().min(1),
      unit: z.string().trim().min(1).nullable(),
      effectiveDate: isoDate.nullable(),
      dateSource: z.enum(['explicit', 'document']).nullable(),
      sourceFormat: z.enum(['table', 'list', 'narrative']),
      details: z.object({
        referenceRange: z.string().nullable(),
        flag: z.string().nullable(),
        startDate: isoDate.nullable(),
        endDate: isoDate.nullable(),
        seriousness: z.string().nullable(),
      }),
      confidence: z.number().min(0).max(1),
    })
  ),
})

type ObservationOutput = z.infer<
  typeof observationOutputSchema
>['observations'][number]

/** One observation stated in a document, citing its one-based page and OCR block. */
export type ExtractedObservation = Omit<ObservationOutput, 'details'> & {
  page: number
  valueNumeric: number | null
  details: Partial<Record<keyof ObservationOutput['details'], string>>
}

/** Rejects invalid output without including document text in errors; numeric values are parsed in code. */
export function validateObservationOutput(
  output: unknown,
  ocr: OcrPage,
  page: number
): ExtractedObservation[] {
  const parsed = observationOutputSchema.safeParse(output)
  if (!parsed.success) throw new Error('Invalid observation schema')

  return parsed.data.observations.map((observation) => {
    if (
      !ocr.blocks.some(
        (block) => block.id === observation.blockId && block.kind !== 'figure'
      )
    )
      throw new Error('Invalid observation block')
    if (
      (observation.effectiveDate === null) !==
      (observation.dateSource === null)
    )
      throw new Error('Invalid observation date source')

    return {
      ...observation,
      page,
      valueNumeric: /^-?\d+(\.\d+)?$/.test(observation.value)
        ? Number(observation.value)
        : null,
      details: Object.fromEntries(
        Object.entries(observation.details).filter(
          (entry): entry is [string, string] => entry[1] !== null
        )
      ),
    }
  })
}

/** Extracts observations from identifier-masked OCR text, one call per page, then removes within-document duplicates. */
export async function extractObservations(
  pages: OcrPage[],
  masked: MaskedSpans
): Promise<ExtractedObservation[]> {
  const maskedPages = maskIdentifiers(pages, masked)
  const perPage = await Promise.all(
    maskedPages.map(async (ocr, index) => {
      if (!ocr.blocks.some((block) => block.text.trim())) return []
      try {
        const result = await generateText({
          model: models.pipeline,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(180_000),
          output: Output.object({ schema: observationOutputSchema }),
          system: extractionPrompt,
          prompt: buildExtractionPrompt(index + 1, ocr),
        })
        return validateObservationOutput(result.output, ocr, index + 1)
      } catch {
        // SDK and schema errors can contain PHI; expose a fixed failure only.
        throw new Error(`Observation extraction failed on page ${index + 1}`)
      }
    })
  )

  const extracted = perPage.flat()
  const observations = dedupeObservations(extracted)
  log.info(
    {
      pageCount: pages.length,
      extractedCount: extracted.length,
      observationCount: observations.length,
    },
    'Observation extraction completed'
  )
  return observations
}
