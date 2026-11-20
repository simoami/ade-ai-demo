import type { OcrPage } from '#stages/ocr/ocr-result'
import type { IdentifierSpan } from '#stages/redact/redaction-types'

/** Identifier ranges to hide from extraction: one-based page, block and end-exclusive offsets. */
export type MaskedSpans = Pick<
  IdentifierSpan,
  'page' | 'blockId' | 'start' | 'end'
>[]

/** Replaces each identifier range in OCR text. */
export const identifierPlaceholder = '[REDACTED]'

/** Returns text blocks with every identifier span replaced; figures are dropped because their pixels may hold identifiers. */
export function maskIdentifiers(
  pages: OcrPage[],
  masked: MaskedSpans
): OcrPage[] {
  for (const span of masked) {
    const block = pages[span.page - 1]?.blocks.find(
      (block) => block.id === span.blockId && block.kind !== 'figure'
    )
    if (!block || span.start >= span.end || span.end > block.text.length)
      throw new Error('Invalid masked span')
  }

  // Word boxes are dropped because their text still holds the identifiers.
  return pages.map((page, index) => ({
    usage: page.usage,
    blocks: page.blocks
      .filter((block) => block.kind !== 'figure')
      .map((block) => {
        const ranges = masked
          .filter(
            (span) => span.page === index + 1 && span.blockId === block.id
          )
          .sort((a, b) => a.start - b.start)
        let text = ''
        let cursor = 0
        for (const { start, end } of ranges) {
          if (end <= cursor) continue
          if (start >= cursor)
            text += block.text.slice(cursor, start) + identifierPlaceholder
          cursor = end
        }
        return { ...block, text: text + block.text.slice(cursor) }
      }),
  }))
}
