import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@repo/logger'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import {
  type Box,
  type Expected,
  expectedSchema,
} from '#evals/fixtures/expected'
import { initializePdfium } from '#stages/render/render-pages'

const log = logger.getSubLogger({ name: 'synthetic-generator' })

/** Version changes whenever generated content or geometry changes. */
export const datasetVersion = 'synthetic-v1'

/** Six short clinical records, four nonclinical records and the render benchmark. */
export const fixtureSpecs = [
  { id: 'clinical-01', pages: 2, kind: 'clinical' },
  { id: 'clinical-02', pages: 3, kind: 'clinical' },
  { id: 'clinical-03', pages: 1, kind: 'clinical' },
  { id: 'clinical-04', pages: 4, kind: 'clinical' },
  { id: 'clinical-05', pages: 5, kind: 'clinical' },
  { id: 'clinical-06', pages: 2, kind: 'clinical' },
  { id: 'consent-01', pages: 1, kind: 'consent' },
  { id: 'consent-02', pages: 2, kind: 'consent' },
  { id: 'fax-01', pages: 1, kind: 'other' },
  { id: 'invoice-01', pages: 1, kind: 'other' },
  { id: 'clinical-20', pages: 20, kind: 'clinical' },
] as const

function randomSource(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Rotates a rectangle clockwise about the page center and returns its enclosing box. */
export function rotateBox(box: Box, degrees: number): Box {
  const angle = (degrees * Math.PI) / 180
  const points = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x = 0, y = 0]) => {
    const dx = (x - 0.5) * 612
    const dy = (y - 0.5) * 792
    return [
      0.5 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / 612,
      0.5 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / 792,
    ]
  })
  const xs = points.map((p) => p[0] ?? 0)
  const ys = points.map((p) => p[1] ?? 0)
  const x = Math.max(0, Math.min(...xs))
  const y = Math.max(0, Math.min(...ys))
  return {
    x,
    y,
    width: Math.min(1, Math.max(...xs)) - x,
    height: Math.min(1, Math.max(...ys)) - y,
  }
}

function fixMetadata(pdf: PDFDocument) {
  const date = new Date('2026-01-01T00:00:00Z')
  pdf.setCreationDate(date)
  pdf.setModificationDate(date)
  pdf.setProducer('Synthetic fixture generator v1')
  pdf.setCreator('Synthetic fixture generator v1')
}

/** Produces deterministic PDFs and validated truth without reading any private inputs. */
export async function generateFixture(
  spec: (typeof fixtureSpecs)[number],
  seed: number
) {
  const random = randomSource(seed)
  const person =
    ['Aven Testmere', 'Bex Samplewick', 'Cora Fictionvale'][
      Math.floor(random() * 3)
    ] ?? 'Aven Testmere'
  const provider =
    ['Dr. Neri Mockwell', 'Dr. Zavi Fableton'][Math.floor(random() * 2)] ??
    'Dr. Neri Mockwell'
  const facility =
    ['Imaginary Fern Clinic', 'Fictional Quartz Health'][
      Math.floor(random() * 2)
    ] ?? 'Imaginary Fern Clinic'
  const mrn = `FAKE-${seed}`
  const dob = '1978-04-12'
  const phone = '202-555-0147'
  const address = '17 Fiction Lane, Exampleville, ZZ 00000'
  const identifiers = [
    [person, 'name'],
    [provider, 'provider'],
    [facility, 'facility'],
    [mrn, 'id'],
    [dob, 'dob'],
    [phone, 'phone'],
    [address, 'address'],
  ] as const
  const clean = await PDFDocument.create()
  fixMetadata(clean)
  const font = await clean.embedFont(StandardFonts.Courier)
  const truth: Expected = {
    id: spec.id,
    datasetVersion,
    seed,
    split: ['clinical-06', 'consent-02', 'invoice-01'].includes(spec.id)
      ? 'held-out'
      : 'development',
    documentClass: spec.kind,
    pages: [],
    observations: [],
  }

  for (let index = 0; index < spec.pages; index++) {
    const page = clean.addPage([612, 792])
    const rotation = (random() - 0.5) * 1.6
    const entry: Expected['pages'][number] = {
      page: index,
      rotation,
      blocks: [],
      scannedBlocks: [],
      pii: [],
    }
    const add = (
      kind: Expected['pages'][number]['blocks'][number]['kind'],
      lines: string[],
      y: number,
      continues: string | null = null
    ) => {
      const id = `p${index + 1}-b${entry.blocks.length + 1}`
      const size = kind === 'heading' ? 13 : 10
      const width = Math.max(
        ...lines.map((line) => font.widthOfTextAtSize(line, size))
      )
      const box = {
        x: 40 / 612,
        y: y / 792,
        width: (width + 8) / 612,
        height: (lines.length * 15 + 8) / 792,
      }
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: 44,
          y: 792 - y - 12 - lineIndex * 15,
          size,
          font,
        })
      })

      if (kind === 'table') {
        lines.forEach((_, row) => {
          page.drawLine({
            start: { x: 40, y: 792 - y - row * 15 - 16 },
            end: { x: 40 + width + 8, y: 792 - y - row * 15 - 16 },
            thickness: 0.3,
            color: rgb(0.6, 0.6, 0.6),
          })
        })
      }
      const text = lines.join('\n')
      entry.blocks.push({ id, kind, text, box, continues })
      let offset = 0
      for (const [lineIndex, line] of lines.entries()) {
        for (const [value, category] of identifiers) {
          for (
            let start = line.indexOf(value);
            start !== -1;
            start = line.indexOf(value, start + value.length)
          ) {
            const span = {
              x: (44 + start * size * 0.6) / 612,
              y: (y + lineIndex * 15 + 2) / 792,
              width: (value.length * size * 0.6) / 612,
              height: 12 / 792,
            }
            entry.pii.push({
              blockId: id,
              start: offset + start,
              end: offset + start + value.length,
              category,
              box: span,
              scannedBox: rotateBox(span, rotation),
            })
          }
        }
        offset += line.length + 1
      }
      return id
    }
    add(
      'header',
      [`DEMO EHR | ${facility}`, `${person} | MRN ${mrn} | DOB ${dob}`],
      25
    )
    add(
      'heading',
      [
        spec.kind === 'clinical'
          ? 'Clinical encounter record'
          : spec.kind === 'consent'
            ? 'Consent to synthetic care'
            : spec.id === 'fax-01'
              ? 'Fax transmission cover'
              : 'Service invoice',
      ],
      85
    )
    const date = `2026-02-${String(10 + index).padStart(2, '0')}`
    if (spec.kind === 'clinical') {
      const glucose = 106 + Math.floor(random() * 30)
      const table = add(
        'table',
        [
          'Test       Date        Value  Unit   Reference   Flag',
          `Glucose    ${date}  ${glucose}    mg/dL  70-99       H`,
          `Sodium     ${date}  140    mmol/L 135-145     N`,
        ],
        135,
        index > 0 ? `p${index}-b3` : null
      )
      const list = add(
        'list',
        [
          `- BP: 128/82 mmHg (${date})`,
          `- Pulse: 76 beats/min (${date})`,
          '- Symptoms: mild fatigue; no dyspnea',
        ],
        230
      )
      const note = add(
        'paragraph',
        [
          `Encounter ${date}. ${provider} reviewed ${person}.`,
          `Glucose was ${glucose} mg/dL on ${date}; sodium was 140 mmol/L.`,
          `Contact: ${phone}. Address:`,
          address,
          'Mild nausea began 2026-02-01 and ended 2026-02-03.',
          'Seriousness: non-serious. No hospitalization was needed.',
          index === 0
            ? 'Plan: review intake and hydration. Note continues on next page.'
            : 'Continued note: hydration improved; maintain follow-up plan.',
        ].map((line) =>
          line.replace(
            'Note continues on next page.',
            spec.pages > 1 ? 'Note continues.' : 'Review complete.'
          )
        ),
        325,
        index > 0 ? `p${index}-b5` : null
      )
      const observation = (
        blockId: string,
        kind: Expected['observations'][number]['kind'],
        name: string,
        value: string,
        unit: string | null,
        sourceFormat: Expected['observations'][number]['sourceFormat'],
        details: Expected['observations'][number]['details'],
        effectiveDate = date
      ) => {
        truth.observations.push({
          id: `o${truth.observations.length + 1}`,
          blockId,
          kind,
          name,
          value,
          unit,
          effectiveDate,
          sourceFormat,
          details,
          duplicateGroup: `${name}-${effectiveDate}`,
        })
      }
      for (const [block, format] of [
        [table, 'table'],
        [note, 'narrative'],
      ] as const) {
        observation(block, 'lab', 'Glucose', String(glucose), 'mg/dL', format, {
          referenceRange: '70-99',
          flag: 'H',
        })
        observation(block, 'lab', 'Sodium', '140', 'mmol/L', format, {
          referenceRange: '135-145',
          flag: 'N',
        })
      }
      observation(list, 'vital', 'Blood pressure', '128/82', 'mmHg', 'list', {})
      observation(list, 'vital', 'Pulse', '76', 'beats/min', 'list', {})
      observation(list, 'symptom', 'Fatigue', 'mild', null, 'list', {})
      observation(
        note,
        'adverse-event',
        'Nausea',
        'mild',
        null,
        'narrative',
        {
          startDate: '2026-02-01',
          endDate: '2026-02-03',
          seriousness: 'non-serious',
        },
        '2026-02-01'
      )
    } else {
      add(
        'paragraph',
        spec.kind === 'consent'
          ? [
              `${person} authorizes evaluation at ${facility}.`,
              'The purpose, alternatives and right to withdraw were explained.',
              'This consent contains no treatment results or observations.',
              `Questions may be directed to ${provider} at ${phone}.`,
            ]
          : spec.id === 'fax-01'
            ? [
                `To: ${provider} | From: ${facility}`,
                `Re: ${person}, MRN ${mrn}`,
                `Return phone: ${phone}`,
                'Synthetic routing cover only; no clinical results enclosed.',
              ]
            : [
                `Bill to: ${person}`,
                address,
                'Administrative service invoice; no clinical results.',
              ],
        140
      )
      add(
        'table',
        spec.kind === 'consent'
          ? [
              'Authorization              Status',
              'Evaluation                 Agreed',
              'Data review                Agreed',
            ]
          : [
              'Item                       Quantity    Amount',
              'Document handling          1           25.00',
              'Total                                  25.00',
            ],
        260
      )
      add(
        'list',
        [
          '- All identities are fictional.',
          '- Generated for software evaluation only.',
        ],
        365
      )
    }
    add(
      'footer',
      [
        `${person} | ${mrn} | DOB ${dob} | Page ${index + 1}/${spec.pages}`,
        'SYNTHETIC - NOT A PATIENT RECORD',
      ],
      730
    )
    entry.scannedBlocks = entry.blocks.map((block) => ({
      ...block,
      box: rotateBox(block.box, rotation),
    }))
    truth.pages.push(entry)
  }
  const cleanBytes = await clean.save()
  const scanned = await PDFDocument.create()
  fixMetadata(scanned)
  const pdfium = await initializePdfium()
  const source = await pdfium.loadDocument(cleanBytes)
  try {
    for (const page of source.pages()) {
      try {
        const rendered = await page.render({ scale: 2, render: 'bitmap' })
        const gray = await sharp(rendered.data, {
          raw: { width: rendered.width, height: rendered.height, channels: 4 },
        })
          .grayscale()
          .removeAlpha()
          .raw()
          .toBuffer()
        for (let i = 0; i < gray.length; i++)
          gray[i] = Math.max(
            0,
            Math.min(255, (gray[i] ?? 255) + Math.floor(random() * 15) - 7)
          )
        const rotated = await sharp(gray, {
          raw: { width: rendered.width, height: rendered.height, channels: 1 },
        })
          .rotate(truth.pages[page.number]?.rotation ?? 0, {
            background: '#ffffff',
          })
          .blur(0.4)
          .png()
          .toBuffer({ resolveWithObject: true })
        const jpeg = await sharp(rotated.data)
          .extract({
            left: Math.floor((rotated.info.width - rendered.width) / 2),
            top: Math.floor((rotated.info.height - rendered.height) / 2),
            width: rendered.width,
            height: rendered.height,
          })
          .jpeg({ quality: 65 })
          .toBuffer()
        const image = await scanned.embedJpg(jpeg)
        scanned
          .addPage([612, 792])
          .drawImage(image, { x: 0, y: 0, width: 612, height: 792 })
      } finally {
        page.close()
      }
    }
  } finally {
    source.destroy()
  }
  return {
    clean: cleanBytes,
    scanned: await scanned.save(),
    expected: expectedSchema.parse(truth),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(
    new URL('../../../fixtures/synthetic/', import.meta.url)
  )
  for (const [index, spec] of fixtureSpecs.entries()) {
    const fixture = await generateFixture(spec, 7300 + index)
    const directory = join(root, spec.id)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'clean.pdf'), fixture.clean)
    await writeFile(join(directory, 'scanned.pdf'), fixture.scanned)
    await writeFile(
      join(directory, 'expected.json'),
      `${JSON.stringify(fixture.expected, null, 2)}\n`
    )
    log.info({ fixtureId: spec.id, pageCount: spec.pages }, 'Generated fixture')
  }
}
