import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { expectedSchema } from '#evals/fixtures/expected'
import type { Box, OcrPage } from '#stages/ocr/ocr-result'
import { burnRedactions } from '#stages/redact/burn-redactions'
import { placeRedactions } from '#stages/redact/place-redactions'
import type { IdentifierSpan } from '#stages/redact/redaction-types'
import { renderPdf } from '#stages/render/render-pages'

const fixture = fileURLToPath(
  new URL('../../../fixtures/synthetic/clinical-01/', import.meta.url)
)

async function characterBoxes(image: Buffer, box: Box) {
  const { width = 0, height = 0 } = await sharp(image).metadata()
  const left = Math.max(0, Math.floor(box.x * width) - 3)
  const top = Math.max(0, Math.floor(box.y * height) - 3)
  const right = Math.min(width, Math.ceil((box.x + box.width) * width) + 3)
  const bottom = Math.min(height, Math.ceil((box.y + box.height) * height) + 3)
  const require = createRequire(import.meta.url)
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath: join(
      dirname(require.resolve('@tesseract.js-data/eng/package.json')),
      '4.0.0'
    ),
    cacheMethod: 'none',
    gzip: true,
  })
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      user_defined_dpi: '144',
    })
    const crop = await sharp(image)
      .extract({ left, top, width: right - left, height: bottom - top })
      .png()
      .toBuffer()
    const { data } = await worker.recognize(crop, {}, { blocks: true })
    return (
      data.blocks?.flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) =>
            line.words.flatMap((word) =>
              word.symbols.map((symbol) => ({
                x0: left + symbol.bbox.x0,
                y0: top + symbol.bbox.y0,
                x1: left + symbol.bbox.x1,
                y1: top + symbol.bbox.y1,
              }))
            )
          )
        )
      ) ?? []
    )
  } finally {
    await worker.terminate()
  }
}

async function assertCharacterCoverage(
  image: Buffer,
  regions: Awaited<ReturnType<typeof placeRedactions>>,
  box: Box,
  kept: number[],
  hidden: number[],
  reference?: { image: Buffer; box: Box; rotation: number }
) {
  const { width = 0, height = 0 } = await sharp(image).metadata()
  const white = await sharp({
    create: { width, height, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer()
  const { data, info } = await sharp(await burnRedactions(white, regions))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const boxes = await characterBoxes(
    reference?.image ?? image,
    reference?.box ?? box
  )
  if (reference) {
    const angle = (reference.rotation * Math.PI) / 180
    for (const box of boxes) {
      const points = [
        [box.x0, box.y0],
        [box.x1, box.y0],
        [box.x1, box.y1],
        [box.x0, box.y1],
      ].map(([x = 0, y = 0]) => [
        width / 2 +
          (x - width / 2) * Math.cos(angle) -
          (y - height / 2) * Math.sin(angle),
        height / 2 +
          (x - width / 2) * Math.sin(angle) +
          (y - height / 2) * Math.cos(angle),
      ])
      box.x0 = Math.ceil(Math.min(...points.map(([x = 0]) => x)))
      box.x1 = Math.floor(Math.max(...points.map(([x = 0]) => x)))
      box.y0 = Math.ceil(Math.min(...points.map(([, y = 0]) => y)))
      box.y1 = Math.floor(Math.max(...points.map(([, y = 0]) => y)))
    }
  }
  assert.equal(boxes.length, 10)
  for (const index of [...kept, ...hidden]) {
    const glyph = boxes[index]
    assert.ok(glyph)
    let covered = 0
    let total = 0
    for (let y = glyph.y0; y < glyph.y1; y++)
      for (let x = glyph.x0; x < glyph.x1; x++) {
        total++
        if (
          (data[(y * width + x) * info.channels] ?? 255) <
          (kept.includes(index) ? 255 : 6)
        )
          covered++
      }
    if (kept.includes(index))
      assert.equal(
        covered,
        0,
        `kept character ${index} has ${covered} masked pixels`
      )
    else
      assert.equal(
        covered,
        total,
        `hidden character ${index} is incompletely covered`
      )
  }
}

for (const variant of ['clean', 'scanned'] as const) {
  test(`covers synthetic ${variant} identifier boxes with limited excess area`, async (t) => {
    const expected = expectedSchema.parse(
      JSON.parse(await readFile(join(fixture, 'expected.json'), 'utf8'))
    )
    const truth = expected.pages[0]
    assert.ok(truth)
    if (variant === 'scanned') assert.notEqual(truth.rotation, 0)

    const directory = await mkdtemp(join(tmpdir(), 'ade-redact-'))
    try {
      await renderPdf(join(fixture, `${variant}.pdf`), directory)
      const image = await readFile(join(directory, '0.png'))
      const { width = 0, height = 0 } = await sharp(image).metadata()
      const identifiers = truth.pii
        .filter((span) => 'blockId' in span)
        .map((span) =>
          span.category === 'dob'
            ? {
                ...span,
                text: span.text.slice(5),
                start: span.start + 5,
                box: {
                  ...span.box,
                  x: span.box.x + span.box.width / 2,
                  width: span.box.width / 2,
                },
                scannedBox: {
                  ...span.scannedBox,
                  x: span.scannedBox.x + span.scannedBox.width / 2,
                  width: span.scannedBox.width / 2,
                },
              }
            : span
        )
      const words = identifiers.map((span) => ({
        text: span.text,
        blockId: span.blockId,
        start: span.start,
        end: span.end,
        box: variant === 'clean' ? span.box : span.scannedBox,
      }))
      const spans: IdentifierSpan[] = identifiers.map((span) => ({
        ...span,
        page: 1,
        confidence: 1,
      }))
      const ocr = {
        blocks: variant === 'clean' ? truth.blocks : truth.scannedBlocks,
        words,
        usage: { latencyMs: 0 },
      }
      const regions = await placeRedactions(
        { pageNumber: 1, image, width, height, ocr },
        spans,
        []
      )
      assert.ok(regions.every((region) => region.state === 'applied'))
      const white = await sharp({
        create: { width, height, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer()
      const { data, info } = await sharp(await burnRedactions(white, regions))
        .raw()
        .toBuffer({ resolveWithObject: true })
      const boxes = words.map((word) => word.box)
      const inside = (x: number, y: number, box: Box) =>
        x >= box.x &&
        x <= box.x + box.width &&
        y >= box.y &&
        y <= box.y + box.height
      let masked = 0
      let outside = 0
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if ((data[(y * width + x) * info.channels] ?? 255) > 5) continue
          masked++
          if (
            !boxes.some((box) =>
              inside((x + 0.5) / width, (y + 0.5) / height, box)
            )
          )
            outside++
        }
      let minimumCoverage = 1
      for (const box of boxes) {
        let total = 0
        let covered = 0
        for (
          let y = Math.ceil(box.y * height);
          y < (box.y + box.height) * height;
          y++
        )
          for (
            let x = Math.ceil(box.x * width);
            x < (box.x + box.width) * width;
            x++
          ) {
            total++
            if ((data[(y * width + x) * info.channels] ?? 255) <= 5) covered++
          }
        minimumCoverage = Math.min(minimumCoverage, covered / total)
        assert.ok(covered / total >= 0.98, `coverage ${covered / total}`)
      }
      // At 144 dpi, one pixel of padding and raster edges cost under 20% of these text boxes.
      t.diagnostic(
        `minimum coverage=${minimumCoverage}; excess masked fraction=${outside / masked}`
      )
      assert.ok(outside / masked < 0.2, `excess ${outside / masked}`)
      {
        const original = truth.pii.find(
          (span) => span.category === 'dob' && 'blockId' in span
        )
        assert.ok(original && 'blockId' in original)
        const exact = await placeRedactions(
          {
            pageNumber: 1,
            image,
            width,
            height,
            ocr: {
              ...ocr,
              words: [
                {
                  text: original.text,
                  blockId: original.blockId,
                  start: original.start,
                  end: original.end,
                  box: variant === 'clean' ? original.box : original.scannedBox,
                },
              ],
            },
          },
          [
            {
              page: 1,
              blockId: original.blockId,
              start: original.start + 5,
              end: original.end,
              category: 'dob',
              confidence: 1,
            },
          ],
          []
        )
        assert.equal(exact[0]?.state, 'applied')
        let reference: { image: Buffer; box: Box; rotation: number } | undefined
        if (variant === 'scanned') {
          const cleanDirectory = join(directory, 'clean')
          await renderPdf(join(fixture, 'clean.pdf'), cleanDirectory)
          reference = {
            image: await readFile(join(cleanDirectory, '0.png')),
            box: original.box,
            rotation: truth.rotation,
          }
        }
        await assertCharacterCoverage(
          image,
          exact,
          variant === 'clean' ? original.box : original.scannedBox,
          [0, 1, 2, 3],
          [5, 6, 7, 8, 9],
          reference
        )
        assert.ok(
          (exact[0]?.box.x ?? 0) > original.box.x + original.box.width * 0.4
        )
      }
      const dob = identifiers.find((span) => span.category === 'dob')
      assert.ok(dob)
      const block = ocr.blocks.find((block) => block.id === dob.blockId)
      assert.ok(block)
      assert.match(block.text.slice(dob.start - 5, dob.start), /\d{4}-/)
      const box = variant === 'clean' ? dob.box : dob.scannedBox
      const yearX = Math.floor((box.x - box.width * 0.5) * width)
      const yearY = Math.floor((box.y + box.height / 2) * height)
      assert.equal(data[(yearY * width + yearX) * info.channels], 255)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
}

const image = await sharp({
  create: { width: 800, height: 200, channels: 3, background: 'white' },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="800" height="200"><text x="30" y="90" font-family="DejaVu Sans" font-size="48">01/15/1985</text></svg>'
      ),
    },
  ])
  .png()
  .toBuffer()
const box = { x: 25 / 800, y: 40 / 200, width: 290 / 800, height: 60 / 200 }
const ocr: OcrPage = {
  blocks: [
    { id: 'b', kind: 'paragraph', text: '01/15/1985', box, continues: null },
  ],
  words: [{ text: '01/15/1985', blockId: 'b', start: 0, end: 10, box }],
  usage: { latencyMs: 0 },
}
const span: IdentifierSpan = {
  page: 1,
  blockId: 'b',
  start: 0,
  end: 5,
  category: 'dob',
  confidence: 1,
}

test('matches partial DOB characters locally and leaves the year uncovered', async () => {
  const regions = await placeRedactions(
    { pageNumber: 1, image, width: 800, height: 200, ocr },
    [span],
    []
  )
  assert.equal(regions.length, 1)
  await assertCharacterCoverage(
    image,
    regions,
    box,
    [6, 7, 8, 9],
    [0, 1, 2, 3, 4]
  )
  assert.equal(regions[0]?.state, 'applied')
  assert.ok((regions[0]?.box.width ?? 1) < box.width * 0.65)
  assert.ok((regions[0]?.box.x ?? 1) + (regions[0]?.box.width ?? 1) < 195 / 800)
  const burned = await sharp(await burnRedactions(image, regions)).metadata()
  assert.deepEqual(
    [burned.width, burned.height, burned.format],
    [800, 200, 'png']
  )
})

test('flags unmatched characters, missing words, and low confidence for review', async () => {
  for (const candidate of [
    { ...ocr, words: [] },
    {
      ...ocr,
      words: ocr.words?.map((word) => ({ ...word, text: 'unmatched' })),
    },
  ]) {
    const regions = await placeRedactions(
      { pageNumber: 1, image, width: 800, height: 200, ocr: candidate },
      [span],
      []
    )
    assert.equal(regions[0]?.state, 'needsReview')
  }
  const regions = await placeRedactions(
    { pageNumber: 1, image, width: 800, height: 200, ocr },
    [{ ...span, end: 10, confidence: 0.69 }],
    []
  )
  assert.equal(regions[0]?.state, 'needsReview')
})

test('flags numeric crops without separable ink geometry for review', async () => {
  const faint = await sharp(image).linear(0.4, 130).png().toBuffer()
  const regions = await placeRedactions(
    { pageNumber: 1, image: faint, width: 800, height: 200, ocr },
    [span],
    []
  )
  assert.equal(regions.length, 1)
  assert.equal(regions[0]?.state, 'needsReview')
  assert.ok((regions[0]?.box.width ?? 0) >= box.width)
})

test('places picture verdicts and printed identifiers and rejects invalid spans', async () => {
  const page = {
    pageNumber: 1,
    image,
    width: 800,
    height: 200,
    ocr: {
      ...ocr,
      blocks: [
        {
          ...ocr.blocks[0],
          id: 'f',
          kind: 'figure' as const,
          text: '',
          box,
          continues: null,
        },
      ],
    },
  }
  const regions = await placeRedactions(
    page,
    [],
    [
      {
        page: 1,
        blockId: 'f',
        kind: 'face',
        decision: 'review',
        confidence: 1,
        identifiers: [{ category: 'name', box }],
      },
    ]
  )
  assert.equal(regions.length, 1)
  assert.equal(regions[0]?.category, 'face')
  assert.ok(regions.every((region) => region.state === 'needsReview'))
  await assert.rejects(
    placeRedactions({ ...page, ocr }, [{ ...span, end: 100 }], []),
    /Invalid identifier span/
  )
  await assert.rejects(
    burnRedactions(image, [
      {
        ...regions[0],
        page: 1,
        blockId: null,
        category: 'name',
        box,
        state: 'applied',
        source: 'text',
        points: [
          [NaN, 0],
          [0, 1],
          [1, 1],
        ],
      },
    ]),
    /Invalid redaction polygon/
  )
})

test('places one polygon per line and follows tilted word alignment', async () => {
  const words = [
    {
      text: 'Ada',
      blockId: 'b',
      start: 0,
      end: 3,
      box: { x: 0.1, y: 0.1, width: 0.1, height: 0.08 },
    },
    {
      text: 'Example',
      blockId: 'b',
      start: 4,
      end: 11,
      box: { x: 0.22, y: 0.12, width: 0.15, height: 0.08 },
    },
    {
      text: 'Street',
      blockId: 'b',
      start: 12,
      end: 18,
      box: { x: 0.1, y: 0.4, width: 0.15, height: 0.08 },
    },
  ]
  const page = {
    pageNumber: 1,
    image,
    width: 800,
    height: 200,
    ocr: {
      blocks: [
        {
          id: 'b',
          kind: 'paragraph' as const,
          text: 'Ada Example\nStreet',
          box,
          continues: null,
        },
      ],
      words,
      usage: { latencyMs: 0 },
    },
  }
  const regions = await placeRedactions(
    page,
    [{ ...span, start: 0, end: 18, category: 'address' }],
    []
  )
  assert.equal(regions.length, 2)
  const points = regions[0]?.points
  assert.ok(points?.[0] && points[1])
  assert.ok(points[1][1] > points[0][1])
  assert.ok(regions.every((region) => region.state === 'applied'))
})
