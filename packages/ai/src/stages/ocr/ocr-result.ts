import { z } from 'zod'

/** Normalized top-left rectangle in page coordinates. */
export const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
})

/** Reading-order OCR block; continuation IDs refer to an earlier page. Figures may carry text read inside them. */
export const blockSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'heading',
    'paragraph',
    'list',
    'table',
    'header',
    'footer',
    'figure',
    'other',
  ]),
  text: z.string(),
  box: boxSchema,
  continues: z.string().nullable(),
})

/** One recognized word in reading order, for providers that return word geometry. */
export const wordSchema = z.object({
  text: z.string(),
  box: boxSchema,
  confidence: z.number().min(0).max(1).optional(),
  blockId: z.string().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().positive().optional(),
})

export type Box = z.infer<typeof boxSchema>

export type Block = z.infer<typeof blockSchema>

export type Word = z.infer<typeof wordSchema>

/** Latency plus what a provider bills on: tokens for LLM providers, reported cost for per-page vendors. */
export type OcrUsage = {
  latencyMs: number
  tokens?: { input: number; cachedInput: number; output: number }
  costUsd?: number
}

/** One transcribed page; `words` is absent when the provider has no word geometry. */
export type OcrPage = { blocks: Block[]; words?: Word[]; usage: OcrUsage }

/** Transcribes one PNG page; `pageNumber` is one-based. */
export type OcrProvider = (
  page: Uint8Array,
  context: { pageNumber: number }
) => Promise<OcrPage>
