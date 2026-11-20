import { logger } from '@repo/logger'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { models } from '#models'
import type { OcrPage } from '#stages/ocr/ocr-result'
import { buildDocumentPrompt, classifyPrompt } from './prompt.ts'

const log = logger.getSubLogger({ name: 'classify' })

/** Clinical documents yield observations, consent documents a summary, other documents nothing. */
export type DocumentClass = 'clinical' | 'consent' | 'other'

/** Document class with a consent summary only for consent documents. */
export type Classification = {
  documentClass: DocumentClass
  consentSummary: string | null
  confidence: number
}

/** Structured classification output before class-specific summary checks. */
export const classificationSchema = z.object({
  documentClass: z.enum(['clinical', 'consent', 'other']),
  consentSummary: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

/** Requires a summary for consent and drops any summary for other classes, without echoing content. */
export function validateClassification(output: unknown): Classification {
  const parsed = classificationSchema.safeParse(output)
  if (!parsed.success) throw new Error('Invalid classification schema')

  const { documentClass, confidence } = parsed.data
  const consentSummary = parsed.data.consentSummary?.trim() || null
  if (documentClass === 'consent' && !consentSummary)
    throw new Error('Consent classification requires a summary')

  return {
    documentClass,
    consentSummary: documentClass === 'consent' ? consentSummary : null,
    confidence,
  }
}

/** Classifies a whole document as clinical, consent or other from its OCR text. */
export async function classifyDocument(
  pages: OcrPage[]
): Promise<Classification> {
  if (!pages.some((ocr) => ocr.blocks.some((block) => block.text.trim())))
    return { documentClass: 'other', consentSummary: null, confidence: 1 }

  let classification: Classification
  try {
    const result = await generateText({
      model: models.fast,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(120_000),
      output: Output.object({ schema: classificationSchema }),
      system: classifyPrompt,
      prompt: buildDocumentPrompt(pages),
    })
    classification = validateClassification(result.output)
  } catch {
    // SDK and schema errors can contain PHI; expose a fixed failure only.
    throw new Error('Document classification failed')
  }

  log.info(
    {
      pageCount: pages.length,
      documentClass: classification.documentClass,
      confidence: classification.confidence,
    },
    'Document classified'
  )
  return classification
}
