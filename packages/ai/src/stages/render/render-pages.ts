import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFiumLibrary } from '@hyzyla/pdfium'
import sharp from 'sharp'

const MAX_PDF_PAGES = 30

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
    if (document.getPageCount() > MAX_PDF_PAGES)
      throw new Error(`Document exceeds ${MAX_PDF_PAGES} pages`)

    for (const page of document.pages()) {
      try {
        const renderStarted = performance.now()
        const image = await page.render({ scale, render: 'bitmap' })
        const bitmap = sharp(image.data, {
          raw: { width: image.width, height: image.height, channels: 4 },
        })
        const png = await bitmap.clone().png().toBuffer()
        await writeFile(join(output, `${page.number}.png`), png, {
          mode: 0o600,
        })

        const renderMs = performance.now() - renderStarted
        const thumbnailStarted = performance.now()
        const thumbnail = await bitmap
          .clone()
          .resize({ width: 240 })
          .webp({ quality: 75 })
          .toBuffer()
        await writeFile(join(output, `${page.number}.webp`), thumbnail, {
          mode: 0o600,
        })

        pages.push({
          page: page.number,
          renderMs,
          thumbnailMs: performance.now() - thumbnailStarted,
        })
      } finally {
        page.close()
      }
    }
  } finally {
    document.destroy()
  }

  return { initMs, totalMs: performance.now() - started, pages }
}
