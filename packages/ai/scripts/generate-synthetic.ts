import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { logger } from '@repo/logger'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const directory = fileURLToPath(
  new URL('../../../fixtures/synthetic/', import.meta.url)
)
await mkdir(directory, { recursive: true })

const document = await PDFDocument.create()

const font = await document.embedFont(StandardFonts.Helvetica)
for (let number = 1; number <= 20; number++) {
  const page = document.addPage([612, 792])
  page.drawText(`SYNTHETIC CLINICAL FIXTURE - page ${number}`, {
    x: 40,
    y: 750,
    font,
    size: 14,
  })
  for (let line = 0; line < 23; line++)
    page.drawText(
      'Synthetic note: Lorem ipsum dolor sit amet. No patient data.',
      { x: 40, y: 715 - line * 18, font, size: 10 }
    )
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 3; column++) {
      page.drawRectangle({
        x: 40 + column * 170,
        y: 100 + row * 24,
        width: 170,
        height: 24,
        borderWidth: 0.5,
        borderColor: rgb(0.5, 0.5, 0.5),
        color: rgb(1, 1, 1),
      })
      page.drawText(
        [`Test ${row + 1}`, `${80 + row}`, 'Synthetic units'][column] ?? '',
        { x: 46 + column * 170, y: 108 + row * 24, font, size: 10 }
      )
    }
  }
}
await writeFile(`${directory}/clinical-20.pdf`, await document.save())
logger.info({ pageCount: 20 }, 'Generated synthetic PDF')
