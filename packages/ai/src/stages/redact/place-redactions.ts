import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import sharp from 'sharp'
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js'
import type { Box, OcrPage } from '#stages/ocr/ocr-result'
import type {
  IdentifierSpan,
  PictureFinding,
  RedactionRegion,
} from './redaction-types.ts'

type Point = [number, number]

type Piece = { box: Box; angle: number; fallback: boolean }

function corners(box: Box): Point[] {
  return [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ]
}

function bounds(points: Point[]): Box {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function polygon(pieces: Piece[], width: number, height: number): Point[] {
  const ordered = [...pieces].sort((a, b) => a.box.x - b.box.x)
  const first = ordered[0]
  const last = ordered.at(-1)
  const alignmentAngle =
    first && last && first !== last
      ? Math.atan2(
          (last.box.y +
            last.box.height / 2 -
            first.box.y -
            first.box.height / 2) *
            height,
          (last.box.x +
            last.box.width / 2 -
            first.box.x -
            first.box.width / 2) *
            width
        )
      : 0
  const angle = pieces.some((piece) => piece.angle !== 0)
    ? pieces.reduce((sum, piece) => sum + piece.angle, 0) / pieces.length
    : alignmentAngle
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const points = pieces
    .flatMap(({ box }) => corners(box))
    .map(([x, y]): Point => [x * width, y * height])
  const rotated = points.map(([x, y]): Point => [x * c + y * s, -x * s + y * c])
  const box = bounds(rotated)
  // One pixel absorbs raster edges while keeping adjacent characters readable.
  return corners({
    x: box.x - 1,
    y: box.y - 1,
    width: box.width + 2,
    height: box.height + 2,
  }).map(
    ([x, y]): Point => [
      Math.max(0, Math.min(1, (x * c - y * s) / width)),
      Math.max(0, Math.min(1, (x * s + y * c) / height)),
    ]
  )
}

/** Places page identifier spans and picture verdicts; uncertain geometry always needs review. */
export async function placeRedactions(
  page: {
    pageNumber: number
    image: Uint8Array
    width: number
    height: number
    ocr: OcrPage
  },
  spans: IdentifierSpan[],
  findings: PictureFinding[]
): Promise<RedactionRegion[]> {
  const regions: RedactionRegion[] = []
  let worker: Worker | undefined
  const { width, height } = page
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error('Invalid redaction page dimensions')

  async function characters(
    box: Box,
    text: string,
    start: number,
    end: number
  ): Promise<Piece[] | null> {
    if (!worker) {
      const require = createRequire(import.meta.url)
      const langPath = dirname(
        require.resolve('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz')
      )
      worker = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: require.resolve(
          'tesseract.js/src/worker-script/node/index.js'
        ),
        langPath,
        cacheMethod: 'none',
        gzip: true,
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        user_defined_dpi: '144',
      })
    }

    const left = Math.max(0, Math.floor(box.x * width) - 3)
    const top = Math.max(0, Math.floor(box.y * height) - 3)
    const right = Math.min(width, Math.ceil((box.x + box.width) * width) + 3)
    const bottom = Math.min(
      height,
      Math.ceil((box.y + box.height) * height) + 3
    )
    const image = await sharp(page.image)
      .extract({ left, top, width: right - left, height: bottom - top })
      .png()
      .toBuffer()
    const { data } = await worker.recognize(image, {}, { blocks: true })
    const lines =
      data.blocks?.flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines)
      ) ?? []
    const symbols = lines.flatMap((line) =>
      line.words.flatMap((word) =>
        word.symbols.map((symbol) => ({ symbol, line }))
      )
    )
    // Match the entire token, so repeated digits cannot silently select the wrong occurrence.
    if (symbols.map(({ symbol }) => symbol.text).join('') !== text) return null

    // LSTM symbol boxes can overlap adjacent date digits even when recognition is exact.
    // Numeric glyphs have no detached marks, so separated ink runs provide tighter boxes.
    if (/^[0-9/-]+$/.test(text)) {
      const { data: pixels, info } = await sharp(image)
        .flatten({ background: 'white' })
        .grayscale()
        .threshold(100)
        .raw()
        .toBuffer({ resolveWithObject: true })
      const glyphs: Box[] = []
      let glyph: Box | undefined
      for (let x = 0; x < info.width; x++) {
        const ys: number[] = []
        for (let y = 0; y < info.height; y++)
          if (pixels[y * info.width + x] === 0) ys.push(y)
        if (ys.length) {
          const top = Math.min(...ys)
          const bottom = Math.max(...ys) + 1
          if (glyph) {
            const y = Math.min(glyph.y, top)
            glyph.height = Math.max(glyph.y + glyph.height, bottom) - y
            glyph.y = y
            glyph.width = x + 1 - glyph.x
          } else {
            glyph = { x, y: top, width: 1, height: bottom - top }
            glyphs.push(glyph)
          }
        } else glyph = undefined
      }
      if (glyphs.length !== text.length) return null
      // Restore thresholded antialias edges; polygon padding keeps the total at two pixels.
      return glyphs.slice(start, end).map((box) => ({
        box: {
          x: (left + box.x - 1) / width,
          y: (top + box.y - 1) / height,
          width: (box.width + 2) / width,
          height: (box.height + 2) / height,
        },
        angle: 0,
        fallback: false,
      }))
    }

    let offset = 0
    return symbols.flatMap(({ symbol, line }) => {
      const symbolStart = offset
      offset += symbol.text.length
      if (offset <= start || symbolStart >= end) return []

      const { x0, y0, x1, y1 } = symbol.bbox
      return [
        {
          box: {
            x: (left + x0) / width,
            y: (top + y0) / height,
            width: (x1 - x0) / width,
            height: (y1 - y0) / height,
          },
          angle: Math.atan2(
            line.baseline.y1 - line.baseline.y0,
            line.baseline.x1 - line.baseline.x0
          ),
          fallback: false,
        },
      ]
    })
  }

  try {
    for (const span of spans.filter((span) => span.page === page.pageNumber)) {
      const block = page.ocr.blocks.find((block) => block.id === span.blockId)
      if (
        !block ||
        !Number.isInteger(span.start) ||
        !Number.isInteger(span.end) ||
        span.start < 0 ||
        span.end <= span.start ||
        span.end > block.text.length ||
        !block.text.slice(span.start, span.end).trim()
      )
        throw new Error('Invalid identifier span')

      const words = (page.ocr.words ?? []).filter(
        (word) =>
          word.blockId === block.id &&
          word.start !== undefined &&
          word.end !== undefined &&
          word.start < span.end &&
          word.end > span.start
      )
      const pieces: Piece[] = []
      let covered = ''
      for (const word of words) {
        const start = word.start ?? 0
        const end = word.end ?? 0
        covered += block.text
          .slice(Math.max(span.start, start), Math.min(span.end, end))
          .replace(/\s/g, '')
        if (span.start <= start && span.end >= end)
          pieces.push({ box: word.box, angle: 0, fallback: false })
        else {
          const matched = await characters(
            word.box,
            word.text,
            Math.max(0, span.start - start),
            Math.min(word.text.length, span.end - start)
          )
          pieces.push(
            ...(matched?.length
              ? matched
              : [{ box: word.box, angle: 0, fallback: true }])
          )
        }
      }
      if (
        !pieces.length ||
        covered !== block.text.slice(span.start, span.end).replace(/\s/g, '')
      ) {
        pieces.splice(0, pieces.length, {
          box: block.box,
          angle: 0,
          fallback: true,
        })
      }

      const lines: Piece[][] = []
      for (const piece of pieces) {
        const line = lines.find((line) =>
          line.some(
            ({ box }) =>
              Math.abs(
                box.y + box.height / 2 - (piece.box.y + piece.box.height / 2)
              ) <
              Math.min(box.height, piece.box.height) * 0.6
          )
        )
        if (line) line.push(piece)
        else lines.push([piece])
      }
      for (const line of lines) {
        const points = polygon(line, width, height)
        regions.push({
          page: page.pageNumber,
          blockId: block.id,
          category: span.category,
          points,
          box: bounds(points),
          state:
            span.confidence < 0.7 || line.some((piece) => piece.fallback)
              ? 'needsReview'
              : 'applied',
          source: 'text',
        })
      }
    }

    for (const finding of findings.filter(
      (finding) => finding.page === page.pageNumber
    )) {
      const block = page.ocr.blocks.find(
        (block) => block.id === finding.blockId && block.kind === 'figure'
      )
      if (!block) throw new Error('Picture finding has no figure block')

      const state =
        finding.confidence < 0.7 || finding.decision === 'review'
          ? 'needsReview'
          : 'applied'
      if (finding.decision !== 'keep') {
        const category =
          finding.kind === 'signature' || finding.kind === 'patientPhoto'
            ? finding.kind
            : 'face'
        regions.push({
          page: page.pageNumber,
          blockId: block.id,
          category,
          points: corners(block.box),
          box: block.box,
          state,
          source: 'picture',
        })
      }
      for (const identifier of finding.identifiers)
        regions.push({
          page: page.pageNumber,
          blockId: block.id,
          category: identifier.category,
          points: corners(identifier.box),
          box: identifier.box,
          state,
          source: 'picture',
        })
    }
    return regions
  } finally {
    await worker?.terminate()
  }
}
