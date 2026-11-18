import { logger } from '@repo/logger'
import { generateText, type LanguageModel, Output } from 'ai'
import { z } from 'zod'
import { blockSchema } from '#evals/fixtures/expected'
import { models } from '#models'
import { ocrPrompt } from './prompt.ts'

const log = logger.getSubLogger({ name: 'ocr' })

const pageSchema = z.object({ blocks: z.array(blockSchema) })

/** Transcribes PNG pages in input order with at most two calls in flight; failures reject. */
export async function ocrPages(
  pages: readonly Uint8Array[],
  model: LanguageModel = models.pipeline
) {
  const results: {
    blocks: z.infer<typeof blockSchema>[]
    latencyMs: number
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
  }[] = []
  let next = 0
  const worker = async () => {
    while (next < pages.length) {
      const index = next++
      const image = pages[index]
      if (!image) throw new Error('Missing OCR page')
      const started = performance.now()
      try {
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
                { type: 'text', text: `Page ${index + 1}.` },
                { type: 'file', data: image, mediaType: 'image/png' },
              ],
            },
          ],
        })
        const output = pageSchema.parse(result.output)
        const ids = new Set<string>()
        for (const block of output.blocks) {
          if (
            ids.has(block.id) ||
            block.box.x + block.box.width > 1.001 ||
            block.box.y + block.box.height > 1.001
          )
            throw new Error('Invalid OCR geometry or duplicate ID')
          ids.add(block.id)
        }
        results[index] = {
          blocks: output.blocks,
          latencyMs: performance.now() - started,
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          cachedInputTokens:
            result.usage.inputTokenDetails.cacheReadTokens ?? 0,
        }
        log.info(
          {
            page: index,
            blockCount: output.blocks.length,
            durationMs: Math.round(performance.now() - started),
          },
          'OCR page completed'
        )
      } catch (error) {
        // Provider errors may contain document content; expose only the failure type.
        const failure = new Error(
          `OCR page ${index + 1} failed (${error instanceof Error ? error.name : 'UnknownError'})`
        )
        failure.name = 'OcrError'
        throw failure
      }
    }
  }
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(2, pages.length) }, worker)
  )
  for (const result of settled)
    if (result.status === 'rejected') throw result.reason
  return results
}
