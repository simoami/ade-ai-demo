import { z } from 'zod'
import { htmlText } from './html-text.ts'
import type { Block, OcrProvider, Word } from './ocr-result.ts'

const API_URL = 'https://www.datalab.to/api/v1/convert'

const POLL_INTERVAL_MS = 2_000

const TIMEOUT_MS = 180_000

const blockKinds: Record<string, Block['kind']> = {
  SectionHeader: 'heading',
  Text: 'paragraph',
  ListGroup: 'list',
  Table: 'table',
  PageHeader: 'header',
  PageFooter: 'footer',
  Picture: 'figure',
  Figure: 'figure',
}

const rectSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])

type Rect = z.infer<typeof rectSchema>

const resultSchema = z.object({
  status: z.string(),
  success: z.boolean().nullish(),
  json: z
    .object({
      children: z.array(
        z.object({
          bbox: rectSchema,
          children: z
            .array(
              z.object({
                id: z.string(),
                block_type: z.string(),
                html: z.string(),
                bbox: rectSchema,
              })
            )
            .nullish(),
        })
      ),
    })
    .nullish(),
  cost_breakdown: z.object({ final_cost_cents: z.number() }).nullish(),
})

const submitSchema = z.object({ request_check_url: z.url() })

// Datalab transcribes text inside a picture here, apart from its generated caption.
const PICTURE_TEXT = /<p class="img-desc">([\s\S]*?)<\/p>/

const WORD_SPAN =
  /<span data-bbox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)" data-confidence="([\d.]+)">([^<]*)<\/span>/g

/** Datalab convert API provider: layout blocks plus word boxes, billed per page. */
export function datalabOcr(mode: 'balanced' | 'accurate'): OcrProvider {
  return async (page) => {
    const apiKey = process.env.DATALAB_API_KEY?.trim()
    if (!apiKey) throw new Error('DATALAB_API_KEY is required')

    const started = performance.now()
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    const headers = { 'X-API-Key': apiKey }

    const form = new FormData()
    form.append(
      'file',
      new Blob([new Uint8Array(page)], { type: 'image/png' }),
      'page.png'
    )
    form.append('output_format', 'json')
    form.append('mode', mode)
    form.append('word_bboxes', 'true')
    form.append('disable_image_captions', 'true')

    const submitted = submitSchema.parse(
      await request(API_URL, { method: 'POST', headers, body: form, signal })
    )

    let result = resultSchema.parse(
      await request(submitted.request_check_url, { headers, signal })
    )
    while (result.status === 'processing') {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      result = resultSchema.parse(
        await request(submitted.request_check_url, { headers, signal })
      )
    }

    const pageResult = result.json?.children[0]
    if (!result.success || !pageResult || !result.cost_breakdown)
      throw new Error('Datalab conversion failed')

    const [, , width, height] = pageResult.bbox
    const normalize = ([x0, y0, x1, y1]: Rect) => ({
      x: clamp(x0 / width),
      y: clamp(y0 / height),
      width: Math.max(clamp(x1 / width) - clamp(x0 / width), 1e-6),
      height: Math.max(clamp(y1 / height) - clamp(y0 / height), 1e-6),
    })

    const blocks: Block[] = []
    const words: Word[] = []
    for (const block of pageResult.children ?? []) {
      const blockWords = Array.from(
        block.html.matchAll(WORD_SPAN),
        (match) => ({
          text: htmlText(match[6] ?? ''),
          box: normalize(rectSchema.parse(match.slice(1, 5).map(Number))),
          confidence: Number(match[5]),
        })
      )

      const kind = blockKinds[block.block_type] ?? 'other'
      const text =
        kind === 'figure'
          ? htmlText(block.html.match(PICTURE_TEXT)?.[1] ?? '')
          : blockWords.map((word) => word.text).join(' ')

      words.push(...blockWords)
      blocks.push({
        id: block.id,
        kind,
        text,
        box: normalize(block.bbox),
        continues: null,
      })
    }

    return {
      blocks,
      words,
      usage: {
        latencyMs: performance.now() - started,
        costUsd: result.cost_breakdown.final_cost_cents / 100,
      },
    }
  }
}

/** Fetches JSON, waiting out rate limits until the caller's abort signal fires. */
async function request(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)

  if (response.status === 429) {
    const retryAfterMs =
      Number(response.headers.get('retry-after') ?? 10) * 1000
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
    init.signal?.throwIfAborted()
    return request(url, init)
  }

  // Response bodies may echo document content, so only the status escapes.
  if (!response.ok) throw new Error(`Datalab responded ${response.status}`)

  return response.json()
}

function clamp(value: number) {
  return Math.min(Math.max(value, 0), 1)
}
