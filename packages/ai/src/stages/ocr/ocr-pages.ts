import { logger } from '@repo/logger'
import { generateText, type LanguageModel, Output } from 'ai'
import { z } from 'zod'
import { models } from '#models'
import {
  type Box,
  blockSchema,
  type OcrPage,
  type OcrProvider,
} from './ocr-result.ts'
import { ocrPrompt } from './prompt.ts'

const log = logger.getSubLogger({ name: 'ocr' })

const pageSchema = z.object({ blocks: z.array(blockSchema) })

/** Model used when callers do not choose an OCR provider. */
export const defaultOcrModel = models.pipeline

/** Vision-model OCR provider; output is schema-validated and returns no word boxes. */
export function llmOcr(model: LanguageModel): OcrProvider {
  return async (page, { pageNumber }) => {
    const started = performance.now()
    const result = await generateText({
      model,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(180_000),
      output: Output.object({ schema: pageSchema }),
      system: ocrPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Page ${pageNumber}.` },
            { type: 'file', data: page, mediaType: 'image/png' },
          ],
        },
      ],
    })

    return {
      blocks: pageSchema.parse(result.output).blocks,
      usage: {
        latencyMs: performance.now() - started,
        tokens: {
          input: result.usage.inputTokens ?? 0,
          cachedInput: result.usage.inputTokenDetails.cacheReadTokens ?? 0,
          output: result.usage.outputTokens ?? 0,
        },
      },
    }
  }
}

/** Transcribes PNG pages in input order with at most two calls in flight; failures reject. */
export async function ocrPages(
  pages: readonly Uint8Array[],
  provider: OcrProvider = llmOcr(defaultOcrModel)
) {
  const results: OcrPage[] = []
  let next = 0

  const worker = async () => {
    while (next < pages.length) {
      const index = next++
      const image = pages[index]
      if (!image) throw new Error('Missing OCR page')

      let page: OcrPage
      try {
        page = await provider(image, { pageNumber: index + 1 })
      } catch (error) {
        // Provider errors may contain document content; expose only the failure type.
        throw ocrError(
          index,
          error instanceof Error ? error.name : 'UnknownError'
        )
      }

      assertGeometry(page, index)
      results[index] = page
      log.info(
        {
          page: index,
          blockCount: page.blocks.length,
          wordCount: page.words?.length,
          durationMs: Math.round(page.usage.latencyMs),
        },
        'OCR page completed'
      )
    }
  }

  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(2, pages.length) }, worker)
  )
  for (const result of settled)
    if (result.status === 'rejected') throw result.reason

  return results
}

function ocrError(index: number, reason: string) {
  const failure = new Error(`OCR page ${index + 1} failed (${reason})`)
  failure.name = 'OcrError'
  return failure
}

function assertGeometry(page: OcrPage, index: number) {
  const outside = ({ box }: { box: Box }) =>
    box.x + box.width > 1.001 || box.y + box.height > 1.001
  const ids = new Set(page.blocks.map((block) => block.id))

  if (
    ids.size !== page.blocks.length ||
    page.blocks.some(outside) ||
    page.words?.some(outside)
  )
    throw ocrError(index, 'invalid geometry or duplicate ID')
}
