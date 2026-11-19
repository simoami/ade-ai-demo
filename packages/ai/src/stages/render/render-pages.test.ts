import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { renderImages, renderPdf } from './render-pages.ts'

test('renders every page to a PNG and a WebP thumbnail', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ade-render-test-'))
  try {
    const document = await PDFDocument.create()
    document.addPage([612, 792])
    document.addPage([612, 792])
    const input = join(directory, 'input.pdf')
    const output = join(directory, 'pages')
    await writeFile(input, await document.save())
    const result = await renderPdf(input, output)
    assert.equal(result.pages.length, 2)
    assert.deepEqual((await readdir(output)).sort(), [
      '0.png',
      '0.webp',
      '1.png',
      '1.webp',
    ])
    for (const page of result.pages) {
      const png = await sharp(join(output, `${page.page}.png`)).metadata()
      assert.equal(png.format, 'png')
      assert.equal(png.width, 1224)
      assert.equal(png.height, 1584)
      const thumbnail = await sharp(
        join(output, `${page.page}.webp`)
      ).metadata()
      assert.equal(thumbnail.format, 'webp')
      assert.equal(thumbnail.width, 240)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects documents exceeding the page limit before writing images', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ade-render-limit-'))
  try {
    const document = await PDFDocument.create()
    for (let i = 0; i < 31; i++) document.addPage()

    const input = join(directory, 'input.pdf')
    const output = join(directory, 'pages')
    await writeFile(input, await document.save())

    await assert.rejects(renderPdf(input, output), /exceeds 30 pages/)
    assert.deepEqual(await readdir(output), [])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects unsupported eval render scales before reading a document', async () => {
  await assert.rejects(
    renderPdf('unused.pdf', 'unused-output', 4),
    /scale must be 2 or 3/
  )
})

test('renders images in upload order, upright and bounded to the page edge', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ade-render-test-'))
  try {
    const photo = join(directory, 'photo.jpg')
    const scan = join(directory, 'scan.png')
    const output = join(directory, 'pages')
    const blank = {
      width: 3200,
      height: 2000,
      channels: 3 as const,
      background: 'white',
    }
    // EXIF orientation 6 means the camera stored a landscape bitmap of a portrait page.
    await sharp({ create: blank })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(photo)
    await sharp({ create: { ...blank, width: 800, height: 1000 } })
      .png()
      .toFile(scan)

    const result = await renderImages([photo, scan], output)

    assert.deepEqual(
      result.pages.map((page) => page.page),
      [0, 1]
    )
    const upright = await sharp(join(output, '0.png')).metadata()
    assert.deepEqual([upright.width, upright.height], [1000, 1600])
    const small = await sharp(join(output, '1.png')).metadata()
    assert.deepEqual([small.width, small.height], [800, 1000])
    await assert.rejects(renderImages([], output), /no pages/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
