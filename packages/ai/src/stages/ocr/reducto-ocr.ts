import Reducto, { toFile } from 'reductoai'
import { htmlText } from './html-text.ts'
import type { Block, OcrProvider } from './ocr-result.ts'

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

/** Reducto parse provider: typed layout blocks without word geometry, billed per page. */
export function reductoOcr(model: 'r-1' | 'r-1-mini'): OcrProvider {
  return async (page, { pageNumber }) => {
    // The client reads REDUCTO_API_KEY and retries rate-limited requests itself.
    const client = new Reducto({ timeout: 180_000 })
    const started = performance.now()

    const upload = await client.upload({
      file: await toFile(page, 'page.png', { type: 'image/png' }),
    })
    const response = await client.parse.run({
      input: upload.file_id,
      settings: { model },
      enhance: { summarize_figures: false },
      formatting: { include: ['signatures'] },
    })
    if (!('result' in response) || response.result.type !== 'full')
      throw new Error('Reducto returned a deferred result')

    const blocks = response.result.chunks
      .flatMap((chunk) => chunk.blocks)
      .map((block, index): Block => {
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

    return { blocks, usage: { latencyMs: performance.now() - started } }
  }
}
