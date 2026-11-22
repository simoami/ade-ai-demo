import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@repo/logger'
import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import { type Expected, expectedSchema } from '#evals/fixtures/expected'
import type { Box } from '#stages/ocr/ocr-result'
import { initializePdfium } from '#stages/render/render-pages'
import { drawPictureForm } from './synthetic-pictures.ts'

const log = logger.getSubLogger({ name: 'synthetic-generator' })

/** Version changes whenever generated content or geometry changes. */
export const datasetVersion = 'synthetic-v3'

/** Fixture list; `scan` is the base scan severity (0 mild to 1 worst) for the scanned variant. */
export const fixtureSpecs = [
  { id: 'clinical-01', pages: 2, kind: 'clinical', scan: 0.2 },
  { id: 'clinical-02', pages: 3, kind: 'clinical', scan: 0.45 },
  { id: 'clinical-03', pages: 1, kind: 'clinical', scan: 0.95 },
  { id: 'clinical-04', pages: 4, kind: 'clinical', scan: 0.3 },
  { id: 'clinical-05', pages: 5, kind: 'clinical', scan: 0.6 },
  { id: 'clinical-06', pages: 2, kind: 'clinical', scan: 0.5 },
  { id: 'consent-01', pages: 1, kind: 'consent', scan: 0.25 },
  { id: 'consent-02', pages: 2, kind: 'consent', scan: 0.4 },
  { id: 'fax-01', pages: 1, kind: 'other', scan: 1 },
  { id: 'invoice-01', pages: 1, kind: 'other', scan: 0.35 },
  { id: 'clinical-20', pages: 20, kind: 'clinical', scan: 0.4 },
  {
    id: 'intake-01',
    pages: 1,
    kind: 'clinical',
    scan: 0.3,
    form: 'intake',
    title: 'Patient intake form',
  },
  {
    id: 'referral-01',
    pages: 2,
    kind: 'clinical',
    scan: 0.35,
    form: 'referral',
    title: 'Specialist referral',
  },
  {
    id: 'consent-03',
    pages: 1,
    kind: 'consent',
    scan: 0.3,
    form: 'consent',
    title: 'Consent and signatures',
  },
  {
    id: 'radiology-01',
    pages: 1,
    kind: 'clinical',
    scan: 0.4,
    form: 'radiology',
    title: 'Radiology report',
  },
  {
    id: 'skin-01',
    pages: 1,
    kind: 'clinical',
    scan: 0.3,
    form: 'skin',
    title: 'Dermatology follow-up',
  },
  { id: 'clinical-followup', pages: 1, kind: 'clinical', scan: 0.3 },
] as const

type Run = { text: string; x: number; align?: 'right' | 'center' }

function randomSource(seed: number) {
  // A MurmurHash3 finalizer spreads adjacent seeds; a raw LCG start correlates their draws.
  let state = Math.imul(seed ^ (seed >>> 16), 0x85ebca6b)
  state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35)
  state = (state ^ (state >>> 16)) >>> 0
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

// Identifiers are kept on one line so PII spans never straddle a wrap.
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
  keep: readonly string[]
) {
  const joined = keep.reduce(
    (result, value) => result.replaceAll(value, value.replaceAll(' ', ' ')),
    text
  )
  const lines: string[] = []
  for (const word of joined.split(' ')) {
    const last = lines.at(-1)
    if (
      last !== undefined &&
      font.widthOfTextAtSize(`${last} ${word}`, size) <= width
    )
      lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.map((line) => line.replaceAll(' ', ' '))
}

function fixMetadata(pdf: PDFDocument) {
  const date = new Date('2026-01-01T00:00:00Z')
  pdf.setCreationDate(date)
  pdf.setModificationDate(date)
  pdf.setProducer('Synthetic fixture generator v2')
  pdf.setCreator('Synthetic fixture generator v2')
}

/** Simulates a skewed, noisy, banded, low-resolution grayscale scan of one rendered page. */
async function degrade(
  rgba: Uint8Array,
  width: number,
  height: number,
  rotation: number,
  severity: number,
  random: () => number
) {
  const gray = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .grayscale()
    .removeAlpha()
    .raw()
    .toBuffer()
  const contrast = 1 - 0.4 * severity
  const lift = 60 * severity
  const paper = Math.round(lift + contrast * 255)
  const rowShift = new Float32Array(height)
  for (let band = 0; band < 2 + severity * 10; band++) {
    const top = Math.floor(random() * height)
    const shift = (random() - 0.5) * 120 * severity
    const end = Math.min(height, top + 2 + Math.floor(random() * 16))
    for (let y = top; y < end; y++) rowShift[y] = (rowShift[y] ?? 0) + shift
  }
  const speckle = 0.001 + 0.008 * severity
  const noise = 16 + 40 * severity
  for (let i = 0; i < gray.length; i++) {
    const roll = random()
    const value =
      lift +
      contrast * (gray[i] ?? 255) +
      (rowShift[Math.floor(i / width)] ?? 0) +
      (random() - 0.5) * noise
    gray[i] =
      roll < speckle / 2
        ? 0
        : roll < speckle
          ? 255
          : Math.max(0, Math.min(255, value))
  }
  for (let streak = 0; streak < Math.floor(severity * 4); streak++) {
    const x = Math.floor(random() * width)
    for (let y = 0; y < height; y++)
      gray[y * width + x] = Math.min(gray[y * width + x] ?? 255, 90)
  }
  const rotated = await sharp(gray, { raw: { width, height, channels: 1 } })
    .rotate(rotation, { background: { r: paper, g: paper, b: paper } })
    .png()
    .toBuffer({ resolveWithObject: true })
  const dpi = 115 - 40 * severity
  const lowResolution = await sharp(rotated.data)
    .extract({
      left: Math.floor((rotated.info.width - width) / 2),
      top: Math.floor((rotated.info.height - height) / 2),
      width,
      height,
    })
    .resize({ width: Math.round((width * dpi) / 144) })
    .png()
    .toBuffer()
  return sharp(lowResolution)
    .resize({ width, height, fit: 'fill' })
    .blur(0.3 + 0.9 * severity)
    .jpeg({ quality: Math.round(70 - 40 * severity) })
    .toBuffer()
}

/** Produces deterministic PDFs and validated truth without reading any private inputs. */
export async function generateFixture(
  spec: (typeof fixtureSpecs)[number],
  seed: number
) {
  const random = randomSource(seed)
  const pick = <T>(values: readonly [T, ...T[]]) =>
    values[Math.floor(random() * values.length)] ?? values[0]
  // The follow-up shares clinical-20 identifiers so demo trends span documents.
  const person =
    spec.id === 'clinical-followup'
      ? 'Bex Samplewick'
      : pick(['Aven Testmere', 'Bex Samplewick', 'Cora Fictionvale'])
  const provider = pick(['Dr. Neri Mockwell', 'Dr. Zavi Fableton'])
  const facility = pick(['Imaginary Fern Clinic', 'Fictional Quartz Health'])
  const mrn = spec.id === 'clinical-followup' ? 'FAKE-7310' : `FAKE-${seed}`
  const dob = '1978-04-12'
  const phone = '202-555-0147'
  const address = '17 Fiction Lane, Exampleville, ZZ 00000'
  const guardian = 'Jun Mockridge'
  const witness = 'Pat Exemplar'
  const identifiers = [
    [person, 'name'],
    [provider, 'provider'],
    [facility, 'facility'],
    [mrn, 'id'],
    [dob, 'dob'],
    [phone, 'phone'],
    [address, 'address'],
    [guardian, 'name'],
    [witness, 'provider'],
  ] as const
  const keep = identifiers.map(([value]) => value)
  const clean = await PDFDocument.create()
  fixMetadata(clean)
  const [sans, sansBold, serif, serifBold, mono] = await Promise.all(
    [
      StandardFonts.Helvetica,
      StandardFonts.HelveticaBold,
      StandardFonts.TimesRoman,
      StandardFonts.TimesRomanBold,
      StandardFonts.Courier,
    ].map((name) => clean.embedFont(name))
  )
  if (!sans || !sansBold || !serif || !serifBold || !mono)
    throw new Error('Standard font embedding failed')
  const serifBody = random() < 0.5
  const body = serifBody ? serif : sans
  const bold = serifBody ? serifBold : sansBold
  const headerStyle = Math.floor(random() * 2)
  const footerStyle = Math.floor(random() * 2)
  const truth: Expected = {
    id: spec.id,
    datasetVersion,
    seed,
    split: ['clinical-06', 'consent-02', 'invoice-01', 'skin-01'].includes(
      spec.id
    )
      ? 'held-out'
      : 'development',
    documentClass: spec.kind,
    pages: [],
    observations: [],
  }
  const previous = { table: '', note: '' }

  for (let index = 0; index < spec.pages; index++) {
    const page = clean.addPage([612, 792])
    const rotation = (random() < 0.5 ? -1 : 1) * (1 + 2 * random())
    const entry: Expected['pages'][number] = {
      page: index,
      rotation,
      blocks: [],
      scannedBlocks: [],
      pii: [],
      figures: [],
    }
    const add = (
      kind: Expected['pages'][number]['blocks'][number]['kind'],
      rows: readonly (string | readonly Run[])[],
      style: {
        x?: number
        y: number
        font?: PDFFont
        size?: number
        ruled?: boolean
        stamp?: boolean
        continues?: string | null
      }
    ) => {
      const id = `p${index + 1}-b${entry.blocks.length + 1}`
      const { x = 40, y, font = body, size = 10 } = style
      const lead = size * 1.3
      const color = style.stamp ? rgb(0.7, 0.12, 0.12) : rgb(0, 0, 0)
      const lines = rows.map((row, line) => {
        const runs: readonly Run[] =
          typeof row === 'string' ? [{ text: row, x }] : row
        return runs.map((run) => {
          const width = font.widthOfTextAtSize(run.text, size)
          const left =
            run.align === 'right'
              ? run.x - width
              : run.align === 'center'
                ? run.x - width / 2
                : run.x
          return {
            text: run.text,
            left,
            width,
            baseline: y + size + line * lead,
          }
        })
      })
      const runs = lines.flat()
      const left = Math.min(...runs.map((run) => run.left)) - 4
      const right = Math.max(...runs.map((run) => run.left + run.width)) + 4
      const bottom = y + size * 1.25 + (lines.length - 1) * lead + 4
      for (const run of runs)
        page.drawText(run.text, {
          x: run.left,
          y: 792 - run.baseline,
          size,
          font,
          color,
        })
      if (style.ruled)
        for (const line of lines) {
          const rule = 792 - (line[0]?.baseline ?? y) - size * 0.35
          page.drawLine({
            start: { x: left, y: rule },
            end: { x: right, y: rule },
            thickness: 0.4,
            color: rgb(0.55, 0.55, 0.55),
          })
        }
      if (style.stamp)
        page.drawRectangle({
          x: left,
          y: 792 - bottom,
          width: right - left,
          height: bottom - y + 4,
          borderColor: color,
          borderWidth: 1.5,
        })
      const box = {
        x: left / 612,
        y: (y - 4) / 792,
        width: (right - left) / 612,
        height: (bottom - y + 4) / 792,
      }
      entry.blocks.push({
        id,
        kind,
        text: lines
          .map((line) => line.map((run) => run.text).join(' '))
          .join('\n'),
        box,
        continues: style.continues ?? null,
      })
      let offset = 0
      for (const line of lines) {
        let column = offset
        for (const run of line) {
          for (const [value, category] of identifiers) {
            for (
              let start = run.text.indexOf(value);
              start !== -1;
              start = run.text.indexOf(value, start + value.length)
            ) {
              const span = {
                x:
                  (run.left +
                    font.widthOfTextAtSize(run.text.slice(0, start), size)) /
                  612,
                y: (run.baseline - size) / 792,
                width: font.widthOfTextAtSize(value, size) / 612,
                height: (size * 1.25) / 792,
              }
              entry.pii.push({
                text: value,
                blockId: id,
                start: column + start,
                end: column + start + value.length,
                category,
                box: span,
                scannedBox: rotateBox(span, rotation),
              })
            }
          }
          column += run.text.length + 1
        }
        offset = column
      }
      return { id, bottom: bottom + 14 }
    }
    const date = new Date(
      Date.UTC(2026, spec.id === 'clinical-followup' ? 2 : 1, 10 + index)
    )
      .toISOString()
      .slice(0, 10)
    let top = 28
    if (spec.id === 'fax-01')
      top = add(
        'header',
        [
          `FROM ${phone}  ${date} 09:14  ${facility.toUpperCase()}  P.${index + 1}/${spec.pages}`,
        ],
        { y: 16, font: mono, size: 8 }
      ).bottom
    // Split headers and footers are separate blocks: left side first, as OCR reads them.
    const header = { y: top, font: sansBold, size: 8.5 }
    top =
      headerStyle === 0
        ? add(
            'header',
            [`DEMO EHR | ${facility}`, `${person} | MRN ${mrn} | DOB ${dob}`],
            { ...header, size: 9 }
          ).bottom
        : Math.max(
            add('header', [facility, `Patient: ${person}  DOB ${dob}`], header)
              .bottom,
            add(
              'header',
              [`Printed ${date}`, `MRN ${mrn}`].map((text) => [
                { text, x: 572, align: 'right' as const },
              ]),
              header
            ).bottom
          )
    const title =
      'title' in spec
        ? spec.title
        : spec.kind === 'clinical'
          ? 'Clinical encounter record'
          : spec.kind === 'consent'
            ? 'Consent to synthetic care'
            : spec.id === 'fax-01'
              ? 'Fax transmission cover'
              : 'Service invoice'
    top = add(
      'heading',
      [headerStyle === 0 ? title : [{ text: title, x: 306, align: 'center' }]],
      { y: top + 4, font: bold, size: 14 }
    ).bottom
    if ('form' in spec)
      await drawPictureForm(spec.form, {
        pdf: clean,
        page,
        pageIndex: index,
        top,
        date,
        random,
        body,
        bold,
        identity: {
          person,
          provider,
          facility,
          mrn,
          dob,
          phone,
          address,
          guardian,
          witness,
        },
        wrap: (text, size, width) => wrap(text, body, size, width, keep),
        add,
        figure: (kind, redaction, box) =>
          entry.figures.push({
            kind,
            redaction,
            box,
            scannedBox: rotateBox(box, rotation),
          }) - 1,
        burnedIn: (figure, text, category, box) => {
          entry.pii.push({
            text,
            category,
            figure,
            box,
            scannedBox: rotateBox(box, rotation),
          })
        },
      })
    else if (spec.kind === 'clinical') {
      const layout = pick(['single', 'columns', 'dense'] as const)
      const glucose = 106 + Math.floor(random() * 30)
      const panel = [
        ['Glucose', String(glucose), 'mg/dL', '70-99', 'H'],
        ['Sodium', '140', 'mmol/L', '135-145', 'N'],
        [
          'Potassium',
          (3.6 + random() * 1.2).toFixed(1),
          'mmol/L',
          '3.5-5.1',
          'N',
        ],
        ['Chloride', '102', 'mmol/L', '98-107', 'N'],
        ['BUN', '14', 'mg/dL', '7-20', 'N'],
        ['Creatinine', '0.9', 'mg/dL', '0.6-1.2', 'N'],
        ['WBC', '7.2', '10^3/uL', '4.0-11.0', 'N'],
        ['Hemoglobin', '13.1', 'g/dL', '12.0-16.0', 'N'],
        ['Platelets', '251', '10^3/uL', '150-400', 'N'],
        ['HbA1c', '6.1', '%', '4.0-5.6', 'H'],
      ] as const
      const labs = panel.slice(
        0,
        layout === 'dense' ? panel.length : layout === 'single' ? 3 : 2
      )
      const columns =
        layout === 'columns'
          ? [324, 414, 420, 470, 548]
          : [40, 230, 240, 310, 400]
      const tableRows = [
        ['Test', 'Result', 'Units', 'Reference', 'Flag'],
        ...labs,
      ].map((cells) =>
        cells.map((text, cell) => ({
          text,
          x: columns[cell] ?? 40,
          align: cell === 1 ? ('right' as const) : undefined,
        }))
      )
      const vitals = [
        ...(spec.id === 'clinical-followup'
          ? [`- SBP: 122 mmHg (${date})`, `- DBP: 78 mmHg (${date})`]
          : [`- BP: 128/82 mmHg (${date})`]),
        `- Pulse: 76 beats/min (${date})`,
        spec.id === 'clinical-followup'
          ? '- Symptoms: mild fatigue since 2026-03-01, ongoing; no dyspnea'
          : '- Symptoms: mild fatigue; no dyspnea',
      ]
      const plan =
        index > 0
          ? 'Continued note: hydration improved; maintain follow-up plan.'
          : spec.pages > 1
            ? 'Plan: review intake and hydration. Note continues.'
            : 'Plan: review intake and hydration. Review complete.'
      const narrative = `Encounter ${date}. ${provider} reviewed ${person}. Glucose was ${glucose} mg/dL on ${date}; sodium was 140 mmol/L. Contact: ${phone}. Address: ${address}. Mild nausea began 2026-02-01 and ended 2026-02-03. Seriousness: non-serious. No hospitalization was needed. ${plan}`
      const followup = spec.id === 'clinical-followup'
      const clinicalNote = followup
        ? `${narrative} Medical history: hypertension since 2020-01-01, ongoing. Medications: metformin 500 mg oral twice daily since 2026-02-15, ongoing. Severe dehydration began 2026-03-02 and ended 2026-03-05. Seriousness: serious (hospitalization). Outcome: recovered. Ongoing: no.`
        : narrative
      const stamp = [`REVIEWED ${date}`, 'Chart copy']
      const continues = (id: string) => (index > 0 ? id : null)
      let ids: { table: string; list: string; note: string }
      if (layout === 'columns') {
        const listBlock = add('list', vitals, { y: top, size: 9.5 })
        const noteBlock = add(
          'paragraph',
          wrap(clinicalNote, body, 10, 250, keep),
          { y: listBlock.bottom, continues: continues(previous.note) }
        )
        const labHeading = add('heading', [`Labs collected ${date}`], {
          x: 320,
          y: top,
          font: bold,
          size: 10.5,
        })
        const tableBlock = add('table', tableRows, {
          y: labHeading.bottom,
          font: sans,
          size: 8.5,
          continues: continues(previous.table),
        })
        add('other', stamp, {
          x: 330,
          y: tableBlock.bottom + 10,
          font: sansBold,
          size: 10,
          stamp: true,
        })
        ids = { table: tableBlock.id, list: listBlock.id, note: noteBlock.id }
      } else {
        const dense = layout === 'dense'
        const tableBlock = add('table', tableRows, {
          y: top,
          font: dense ? sans : mono,
          size: dense ? 7.5 : 9,
          ruled: !dense,
          continues: continues(previous.table),
        })
        const listBlock = add('list', vitals, { y: tableBlock.bottom })
        const noteBlock = add(
          'paragraph',
          wrap(clinicalNote, body, dense ? 9 : 10, 520, keep),
          {
            y: listBlock.bottom,
            size: dense ? 9 : 10,
            continues: continues(previous.note),
          }
        )
        if (!dense)
          add('other', stamp, {
            x: 400,
            y: noteBlock.bottom + 10,
            font: sansBold,
            size: 10,
            stamp: true,
          })
        ids = { table: tableBlock.id, list: listBlock.id, note: noteBlock.id }
      }
      const { table, list, note } = ids
      Object.assign(previous, { table, note })
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
      for (const [name, value, unit, referenceRange, flag] of labs)
        observation(table, 'lab', name, value, unit, 'table', {
          referenceRange,
          flag,
          rangeLow: Number(referenceRange.split('-')[0]),
          rangeHigh: Number(referenceRange.split('-')[1]),
          flagNormalized: flag === 'H' ? 'high' : 'normal',
        })
      for (const [name, value, unit, referenceRange, flag] of panel.slice(0, 2))
        observation(note, 'lab', name, value, unit, 'narrative', {
          referenceRange,
          flag,
          rangeLow: Number(referenceRange.split('-')[0]),
          rangeHigh: Number(referenceRange.split('-')[1]),
          flagNormalized: flag === 'H' ? 'high' : 'normal',
        })
      observation(
        list,
        'vital',
        'Systolic blood pressure',
        followup ? '122' : '128',
        'mmHg',
        'list',
        {}
      )
      observation(
        list,
        'vital',
        'Diastolic blood pressure',
        followup ? '78' : '82',
        'mmHg',
        'list',
        {}
      )
      if (followup) {
        observation(
          note,
          'medical-history',
          'Hypertension',
          'present',
          null,
          'narrative',
          { startDate: '2020-01-01', ongoing: true }
        )
        observation(
          note,
          'medication',
          'Metformin',
          '500 mg',
          'mg',
          'narrative',
          {
            route: 'oral',
            frequency: 'twice daily',
            startDate: '2026-02-15',
            ongoing: true,
          }
        )
        observation(
          note,
          'adverse-event',
          'Dehydration',
          'severe',
          null,
          'narrative',
          {
            startDate: '2026-03-02',
            endDate: '2026-03-05',
            seriousness: 'serious (hospitalization)',
            serious: true,
            outcome: 'recovered',
            ongoing: false,
          },
          '2026-03-02'
        )
      }
      observation(list, 'vital', 'Pulse', '76', 'beats/min', 'list', {})
      observation(
        list,
        'symptom',
        'Fatigue',
        'mild',
        null,
        'list',
        followup ? { startDate: '2026-03-01', ongoing: true } : {},
        followup ? '2026-03-01' : date
      )
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
          serious: false,
        },
        '2026-02-01'
      )
    } else {
      const fax = spec.id === 'fax-01'
      top = add(
        'paragraph',
        spec.kind === 'consent'
          ? wrap(
              `${person} authorizes evaluation at ${facility}. The purpose, alternatives and right to withdraw were explained. This consent contains no treatment results or observations. Questions may be directed to ${provider} at ${phone}.`,
              body,
              10,
              520,
              keep
            )
          : fax
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
        { y: top, font: fax ? mono : body }
      ).bottom
      if (fax)
        top = add('other', [`RECEIVED ${date}`, 'Medical records'], {
          x: 380,
          y: top,
          font: sansBold,
          size: 11,
          stamp: true,
        }).bottom
      const [columns, rows] =
        spec.kind === 'consent'
          ? [
              [40, 330],
              [
                ['Authorization', 'Status'],
                ['Evaluation', 'Agreed'],
                ['Data review', 'Agreed'],
              ],
            ]
          : [
              [40, 330, 420],
              [
                ['Item', 'Quantity', 'Amount'],
                ['Document handling', '1', '25.00'],
                ['Records copy fee', '12', '6.00'],
                ['Total', '', '31.00'],
              ],
            ]
      top = add(
        'table',
        rows.map((cells) =>
          cells.flatMap((text, cell) =>
            text
              ? [
                  {
                    text,
                    x: columns[cell] ?? 40,
                    align: cell > 0 ? ('right' as const) : undefined,
                  },
                ]
              : []
          )
        ),
        { y: top, font: sans, size: 9.5, ruled: spec.id === 'invoice-01' }
      ).bottom
      add(
        'list',
        [
          '- All identities are fictional.',
          '- Generated for software evaluation only.',
        ],
        { y: top }
      )
    }
    if (footerStyle === 0)
      add(
        'footer',
        [
          `${person} | ${mrn} | DOB ${dob} | Page ${index + 1}/${spec.pages}`,
          'SYNTHETIC - NOT A PATIENT RECORD',
        ],
        { y: 742, size: 8 }
      )
    else {
      add(
        'footer',
        [
          'SYNTHETIC - NOT A PATIENT RECORD',
          `${person} | MRN ${mrn} | Confidential synthetic data for software evaluation only.`,
        ],
        { y: 742, size: 7 }
      )
      add(
        'footer',
        [
          [
            {
              text: `Page ${index + 1} of ${spec.pages}`,
              x: 572,
              align: 'right',
            },
          ],
        ],
        { y: 742, size: 7 }
      )
    }
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
        const severity = Math.min(
          1,
          Math.max(0, spec.scan + (random() - 0.5) * 0.3)
        )
        const image = await scanned.embedJpg(
          await degrade(
            rendered.data,
            rendered.width,
            rendered.height,
            truth.pages[page.number]?.rotation ?? 0,
            severity,
            random
          )
        )
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
