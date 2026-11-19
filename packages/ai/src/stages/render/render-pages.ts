import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFiumLibrary } from '@hyzyla/pdfium'
import sharp, { type Sharp } from 'sharp'

const MAX_PAGES = 30

// Matches the long edge of a letter page rendered at scale 2, so photos cost no more to read than PDFs.
const MAX_IMAGE_EDGE = 1600

let library: Promise<PDFiumLibrary> | undefined

/** Shares PDFium initialization and permits retry after initialization fails. */
export async function initializePdfium(): Promise<PDFiumLibrary> {
  library ??= PDFiumLibrary.init().catch((error) => {
    library = undefined
    throw error
  })

  return library
}

/** Renders a bounded PDF to private page images and thumbnails with timing metadata. */
export async function renderPdf(input: string, output: string, scale = 2) {
  if (![2, 3].includes(scale)) throw new Error('Render scale must be 2 or 3')

  const started = performance.now()
  const initStarted = performance.now()
  const pdfium = await initializePdfium()
  const initMs = performance.now() - initStarted

  await mkdir(output, { recursive: true, mode: 0o700 })
  const document = await pdfium.loadDocument(await readFile(input))
  const pages: { page: number; renderMs: number; thumbnailMs: number }[] = []

  try {
    if (document.getPageCount() > MAX_PAGES)
      throw new Error(`Document exceeds ${MAX_PAGES} pages`)

    for (const page of document.pages()) {
      try {
        const renderStarted = performance.now()
        const image = await page.render({ scale, render: 'bitmap' })
        const bitmap = sharp(image.data, {
          raw: { width: image.width, height: image.height, channels: 4 },
        })
        pages.push(await writePage(bitmap, output, page.number, renderStarted))
      } finally {
        page.close()
      }
    }
  } finally {
    document.destroy()
  }

  return { initMs, totalMs: performance.now() - started, pages }
}

/** Renders uploaded PNG or JPEG files, in upload order, as the pages of one document. */
export async function renderImages(inputs: readonly string[], output: string) {
  if (!inputs.length) throw new Error('Document has no pages')
  if (inputs.length > MAX_PAGES)
    throw new Error(`Document exceeds ${MAX_PAGES} pages`)

  const started = performance.now()
  await mkdir(output, { recursive: true, mode: 0o700 })

  const pages: { page: number; renderMs: number; thumbnailMs: number }[] = []
  for (const [index, input] of inputs.entries()) {
    const renderStarted = performance.now()
    const bitmap = sharp(await readFile(input))
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
    pages.push(await writePage(bitmap, output, index, renderStarted))
  }

  return { initMs: 0, totalMs: performance.now() - started, pages }
}

async function writePage(
  bitmap: Sharp,
  output: string,
  page: number,
  renderStarted: number
) {
  const png = await bitmap.clone().png().toBuffer()
  await writeFile(join(output, `${page}.png`), png, { mode: 0o600 })

  const renderMs = performance.now() - renderStarted
  const thumbnailStarted = performance.now()
  const thumbnail = await bitmap
    .clone()
    .resize({ width: 240 })
    .webp({ quality: 75 })
    .toBuffer()
  await writeFile(join(output, `${page}.webp`), thumbnail, { mode: 0o600 })

  return { page, renderMs, thumbnailMs: performance.now() - thumbnailStarted }
}
