import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFiumLibrary } from '@hyzyla/pdfium'
import sharp from 'sharp'

let library: Promise<PDFiumLibrary> | undefined

export async function initializePdfium(): Promise<PDFiumLibrary> {
  library ??= PDFiumLibrary.init().catch((error) => {
    library = undefined
    throw error
  })

  return library
}

export async function renderPdf(input: string, output: string) {
  const started = performance.now()
  const initStarted = performance.now()
  const pdfium = await initializePdfium()
  const initMs = performance.now() - initStarted

  await mkdir(output, { recursive: true, mode: 0o700 })
  const document = await pdfium.loadDocument(await readFile(input))
  const pages: { page: number; renderMs: number; thumbnailMs: number }[] = []

  try {
    if (document.getPageCount() > 20)
      throw new Error('Document exceeds 20 pages')

    for (const page of document.pages()) {
      try {
        const renderStarted = performance.now()
        const image = await page.render({ scale: 2, render: 'bitmap' })
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
