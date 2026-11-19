import Reducto, { type ClientOptions, toFile } from 'reductoai'
import { z } from 'zod'
import { htmlText } from './html-text.ts'
import type { Block, OcrProvider, Word } from './ocr-result.ts'

const blockKinds: Record<string, Block['kind']> = {
  Title: 'heading',
  'Section Header': 'heading',
  Text: 'paragraph',
  'Key Value': 'paragraph',
  'List Item': 'list',
  Table: 'table',
  Header: 'header',
  Footer: 'footer',
  'Page Number': 'footer',
  Figure: 'figure',
  Signature: 'figure',
}

const citationsSchema = z.object({
  word_citations: z
    .array(
      z.object({
        text: z.string(),
        bbox: z
          .object({
            left: z.number(),
            top: z.number(),
            width: z.number(),
            height: z.number(),
          })
          .nullable(),
      })
    )
    .optional(),
})

/** Reducto parse provider: typed layout blocks, plus word boxes from citations on `r-1`; billed per page. */
export function reductoOcr(
  model: 'r-1' | 'r-1-mini',
  clientOptions: ClientOptions = {}
): OcrProvider {
  return async (page, { pageNumber }) => {
    // The client reads REDUCTO_API_KEY and retries rate-limited requests itself.
    const client = new Reducto({ timeout: 180_000, ...clientOptions })
    const started = performance.now()

    const upload = await client.upload({
      file: await toFile(page, 'page.png', { type: 'image/png' }),
    })
    const response = await client.parse.run({
      input: upload.file_id,
      // Word citations require r-1.
      settings: { model, return_citations: model === 'r-1' },
      enhance: { summarize_figures: false },
      formatting: { include: ['signatures'] },
    })
    if (!('result' in response) || response.result.type !== 'full')
      throw new Error('Reducto returned a deferred result')

    const parsed = response.result.chunks.flatMap((chunk) => chunk.blocks)
    const words: Word[] = parsed.flatMap((block) =>
      (citationsSchema.parse(block.extra ?? {}).word_citations ?? []).flatMap(
        ({ text, bbox }) =>
          bbox
            ? [
                {
                  text,
                  box: {
                    x: bbox.left,
                    y: bbox.top,
                    width: bbox.width,
                    height: bbox.height,
                  },
                },
              ]
            : []
      )
    )

    const blocks = parsed.map((block, index): Block => {
      const kind = blockKinds[block.type] ?? 'other'
      return {
        id: `p${pageNumber}-b${index + 1}`,
        kind,
        // Figure content is a generated description, not text printed in the picture.
        text: kind === 'figure' ? '' : htmlText(block.content),
        box: {
          x: block.bbox.left,
          y: block.bbox.top,
          width: block.bbox.width,
          height: block.bbox.height,
        },
        continues: null,
      }
    })

    return {
      blocks,
      words: model === 'r-1' ? words : undefined,
      usage: { latencyMs: performance.now() - started },
    }
  }
}
