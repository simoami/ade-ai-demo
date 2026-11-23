import type { IdentifierHashes } from '@repo/db'
import { logger } from '@repo/logger'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { hashIdentifier, type IdentifierField } from '#identity/hash-identifier'
import { models } from '#models'
import { buildDocumentPrompt } from '#stages/classify/prompt'
import type { OcrPage } from '#stages/ocr/ocr-result'
import { DEMOGRAPHICS_PROMPT } from './prompt.ts'

const log = logger.getSubLogger({ name: 'demographics' })

/** Patient identifiers read from a document; values never leave the step unhashed. */
export type Demographics = {
  lastName?: string
  firstName?: string
  birthDate?: string
  mrn?: string
  sex?: 'Female' | 'Male' | 'Unknown'
}

const identifierFields = [
  'lastName',
  'firstName',
  'birthDate',
  'mrn',
] as const satisfies readonly IdentifierField[]

/** Structured demographics output; strict outputs need every key, so absence is null. */
export const demographicsSchema = z.object({
  lastName: z.string().nullable(),
  firstName: z.string().nullable(),
  birthDate: z.string().nullable(),
  mrn: z.string().nullable(),
  sex: z.enum(['Female', 'Male', 'Unknown']),
})

/** Trims values, drops blanks and rejects non-ISO birth dates without echoing content. */
export function validateDemographics(output: unknown): Demographics {
  const parsed = demographicsSchema.safeParse(output)
  if (!parsed.success) throw new Error('Invalid demographics schema')

  const demographics: Demographics = { sex: parsed.data.sex }
  for (const field of identifierFields) {
    const value = parsed.data[field]?.trim()
    if (value) demographics[field] = value
  }
  if (
    demographics.birthDate &&
    !z.iso.date().safeParse(demographics.birthDate).success
  )
    throw new Error('Invalid demographics birth date')

  return demographics
}

/** Keyed hashes of the identifiers present; sex is not an identifier and stays plain. */
export function hashDemographics(
  demographics: Demographics,
  key: string
): IdentifierHashes {
  const hashes: IdentifierHashes = {}
  for (const field of identifierFields) {
    const value = demographics[field]
    if (value) hashes[field] = hashIdentifier(field, value, key)
  }
  return hashes
}

/** Reads the document subject's name, birth date, MRN and sex with structured output. */
export async function readDemographics(
  pages: OcrPage[]
): Promise<Demographics> {
  if (!pages.some((ocr) => ocr.blocks.some((block) => block.text.trim())))
    return { sex: 'Unknown' }

  let demographics: Demographics
  try {
    const result = await generateText({
      model: models.pipeline,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(120_000),
      output: Output.object({ schema: demographicsSchema }),
      system: DEMOGRAPHICS_PROMPT,
      prompt: buildDocumentPrompt(pages),
    })
    demographics = validateDemographics(result.output)
  } catch {
    // SDK and schema errors can contain PHI; expose a fixed failure only.
    throw new Error('Demographics reading failed')
  }

  log.info(
    {
      pageCount: pages.length,
      fields: identifierFields.filter((field) => demographics[field]),
    },
    'Demographics read'
  )
  return demographics
}
