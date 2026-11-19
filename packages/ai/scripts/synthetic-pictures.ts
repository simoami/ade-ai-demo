import { readFile } from 'node:fs/promises'
import fontkit from '@pdf-lib/fontkit'
import {
  degrees,
  type PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
} from 'pdf-lib'
import sharp from 'sharp'
import type { ExpectedFigure, ExpectedPage } from '#evals/fixtures/expected'
import type { Box } from '#stages/ocr/ocr-result'

const assets = new URL('../../../fixtures/assets/', import.meta.url)

const patientPortraits = [1, 2, 3, 4, 7, 8]

const clinicianPortraits = [5, 6]

const ink = rgb(0.1, 0.1, 0.35)

const outline = rgb(0.25, 0.25, 0.25)

/** Outline icons on a 24-unit grid, drawn as vector paths. */
const icons = {
  phone:
    'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z',
  pin: 'M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z M12 6a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  calendar: 'M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4',
  envelope: 'M3 6h18v12H3z M3 6l9 7 9-7',
} as const

/** Picture-bearing layouts appended after the standard header and title. */
export type PictureForm =
  | 'intake'
  | 'referral'
  | 'consent'
  | 'radiology'
  | 'skin'

type Row = string | readonly { text: string; x: number }[]

/** Drawing primitives and identities the main generator hands to a layout. */
export type PictureContext = {
  pdf: PDFDocument
  page: PDFPage
  pageIndex: number
  top: number
  date: string
  random: () => number
  body: PDFFont
  bold: PDFFont
  identity: {
    person: string
    provider: string
    facility: string
    mrn: string
    dob: string
    phone: string
    address: string
    guardian: string
    witness: string
  }
  wrap: (text: string, size: number, width: number) => string[]
  add: (
    kind: ExpectedPage['blocks'][number]['kind'],
    rows: readonly Row[],
    style: { x?: number; y: number; font?: PDFFont; size?: number }
  ) => { id: string; bottom: number }
  figure: (
    kind: ExpectedFigure['kind'],
    redaction: ExpectedFigure['redaction'],
    box: Box
  ) => number
  burnedIn: (
    figure: number,
    text: string,
    category: 'name' | 'id' | 'dob',
    box: Box
  ) => void
}

function toBox(x: number, top: number, width: number, height: number): Box {
  return { x: x / 612, y: top / 792, width: width / 612, height: height / 792 }
}

async function placeImage(
  context: PictureContext,
  bytes: Uint8Array,
  x: number,
  top: number,
  width: number
) {
  const image = await context.pdf.embedJpg(bytes)
  const height = (image.height / image.width) * width
  context.page.drawImage(image, { x, y: 792 - top - height, width, height })

  return {
    box: toBox(x, top, width, height),
    height,
    scale: width / image.width,
  }
}

function portrait(number: number) {
  return readFile(
    new URL(`portrait-${String(number).padStart(2, '0')}.jpg`, assets)
  )
}

function pick<T>(random: () => number, values: readonly T[]) {
  const value = values[Math.floor(random() * values.length)]
  if (value === undefined) throw new Error('Empty choice')

  return value
}

function drawIcon(
  context: PictureContext,
  name: keyof typeof icons,
  x: number,
  top: number
) {
  context.page.drawSvgPath(icons[name], {
    x,
    y: 792 - top,
    scale: 0.5,
    borderColor: outline,
    borderWidth: 1.6,
  })
  context.figure('icon', 'keep', toBox(x, top, 12, 12))
}

/** Lines of contact text, each led by an outline icon. */
function iconLines(
  context: PictureContext,
  top: number,
  lines: readonly (readonly [keyof typeof icons, string])[]
) {
  let y = top
  for (const [icon, text] of lines) {
    drawIcon(context, icon, 40, y + 1)
    y = context.add('paragraph', [text], { x: 58, y, size: 10 }).bottom - 4
  }

  return y
}

/** Draws a handwritten name with seeded slant and returns its rotated bounding box. */
function signature(
  context: PictureContext,
  font: PDFFont,
  name: string,
  x: number,
  baseline: number
) {
  const size = 20 + context.random() * 4
  const angle = (context.random() - 0.5) * 10
  context.page.drawText(name, {
    x,
    y: 792 - baseline,
    size,
    font,
    color: ink,
    rotate: degrees(angle),
  })

  const width = font.widthOfTextAtSize(name, size)
  const radians = (angle * Math.PI) / 180
  const corners = [
    [0, -0.35 * size],
    [width, -0.35 * size],
    [width, 0.95 * size],
    [0, 0.95 * size],
  ].map(([cx = 0, cy = 0]) => [
    x + cx * Math.cos(radians) - cy * Math.sin(radians),
    baseline - (cx * Math.sin(radians) + cy * Math.cos(radians)),
  ])
  const xs = corners.map(([px = 0]) => px)
  const ys = corners.map(([, py = 0]) => py)
  // Script glyphs overhang their advance widths, so the box keeps a small margin.
  const left = Math.min(...xs) - 3
  const top = Math.min(...ys) - 3

  return toBox(left, top, Math.max(...xs) + 3 - left, Math.max(...ys) + 3 - top)
}

/** Renders white label lines into the X-ray raster, returning pixel boxes per line. */
async function burnLabel(xray: Uint8Array, lines: readonly string[]) {
  const layers = await Promise.all(
    lines.map((line) =>
      sharp({
        text: {
          text: `<span foreground="#ffffff">${line}</span>`,
          font: 'sans bold 15',
          dpi: 72,
          rgba: true,
        },
      })
        .png()
        .toBuffer({ resolveWithObject: true })
    )
  )

  let top = 14
  const placed = layers.map(({ data, info }) => {
    const layer = {
      input: data,
      left: 14,
      top,
      width: info.width,
      height: info.height,
    }
    top += info.height + 4
    return layer
  })
  const image = await sharp(xray)
    .composite(placed.map(({ input, left, top }) => ({ input, left, top })))
    .jpeg({ quality: 85 })
    .toBuffer()

  return { image, boxes: placed }
}

/** Draws one page of a picture layout below the title. */
export async function drawPictureForm(
  form: PictureForm,
  context: PictureContext
) {
  const { identity, date, top } = context
  const { person, provider, facility, mrn, dob, phone, address } = identity

  if (form === 'intake') {
    const fields = context.add(
      'paragraph',
      [`Name: ${person}`, `Date of birth: ${dob}`, `MRN: ${mrn}`],
      { y: top + 6, size: 11 }
    )
    const photo = await placeImage(
      context,
      await portrait(pick(context.random, patientPortraits)),
      440,
      top,
      110
    )
    context.figure('patientPhoto', 'redact', photo.box)

    const y = iconLines(
      context,
      Math.max(fields.bottom, top + photo.height) + 12,
      [
        ['phone', `Phone: ${phone}`],
        ['pin', `Address: ${address}`],
        ['calendar', 'Next visit: 2026-03-02'],
        ['envelope', 'Messages: patient portal only'],
      ]
    )
    context.add(
      'paragraph',
      context.wrap(
        'Reason for visit: annual review. Allergies: none reported. Current medication: none.',
        10,
        520
      ),
      { y: y + 10 }
    )
    return
  }

  if (form === 'referral' && context.pageIndex === 0) {
    context.page.drawCircle({
      x: 62,
      y: 792 - top - 22,
      size: 22,
      borderColor: rgb(0.1, 0.45, 0.4),
      borderWidth: 2.5,
    })
    context.page.drawSvgPath('M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z', {
      x: 50,
      y: 792 - top - 10,
      scale: 1,
      color: rgb(0.1, 0.45, 0.4),
    })
    context.figure('logo', 'keep', toBox(40, top, 44, 44))
    context.add('paragraph', [facility, 'Referral letter'], {
      x: 94,
      y: top + 8,
      font: context.bold,
      size: 11,
    })

    const photo = await placeImage(
      context,
      await portrait(pick(context.random, clinicianPortraits)),
      480,
      top,
      90
    )
    context.figure('face', 'keep', photo.box)
    context.add('paragraph', [provider, 'Attending physician'], {
      x: 470,
      y: top + photo.height + 4,
      size: 8,
    })

    const columns = top + photo.height + 40
    context.add(
      'paragraph',
      context.wrap(
        `Dear colleague, I am referring ${person} (DOB ${dob}) for evaluation of intermittent palpitations first noted on ${date}. Episodes last under a minute and resolve at rest. There is no syncope or chest pain.`,
        10,
        250
      ),
      { y: columns }
    )
    context.add(
      'paragraph',
      context.wrap(
        'A resting ECG showed sinus rhythm at 72 beats/min. Thyroid function was normal. Please assess for ambulatory rhythm monitoring and advise on further management.',
        10,
        250
      ),
      { x: 320, y: columns }
    )
    return
  }

  if (form === 'referral') {
    context.add(
      'paragraph',
      context.wrap(
        'Community wellness program: free blood pressure checks are offered every Thursday in the main lobby. Volunteers can explain home monitoring and healthy eating resources.',
        10,
        320
      ),
      { y: 300 }
    )
    const photo = await placeImage(
      context,
      await portrait(pick(context.random, patientPortraits)),
      420,
      290,
      110
    )
    context.figure('face', 'review', photo.box)
    return
  }

  if (form === 'consent') {
    let y =
      context.add(
        'paragraph',
        context.wrap(
          `${person} authorizes evaluation and treatment at ${facility}. The purpose, alternatives and right to withdraw were explained. A guardian countersigns for this synthetic record.`,
          10,
          520
        ),
        { y: top }
      ).bottom + 20

    context.pdf.registerFontkit(fontkit)
    const hand = await context.pdf.embedFont(
      await readFile(new URL('fonts/DancingScript.ttf', assets))
    )
    for (const [label, name] of [
      ['Patient', person],
      ['Guardian', identity.guardian],
      ['Witness', identity.witness],
    ] as const) {
      context.figure(
        'signature',
        'redact',
        signature(context, hand, name, 60, y + 30)
      )
      context.page.drawLine({
        start: { x: 50, y: 792 - y - 38 },
        end: { x: 320, y: 792 - y - 38 },
        thickness: 0.6,
        color: outline,
      })
      context.add('paragraph', [`${label}: ${name}    Date: ${date}`], {
        x: 50,
        y: y + 42,
        size: 9,
      })
      y += 80
    }
    return
  }

  if (form === 'radiology') {
    const info = context.add(
      'paragraph',
      [
        'Exam: Chest X-ray, PA view',
        `Date: ${date}`,
        `Ordered by: ${provider}`,
      ],
      { y: top }
    )
    const label = [person.toUpperCase(), mrn, dob]
    const burned = await burnLabel(
      await readFile(new URL('xray-chest.jpg', assets)),
      label
    )
    const image = await placeImage(context, burned.image, 40, info.bottom, 300)
    const index = context.figure('medicalImage', 'keep', image.box)
    burned.boxes.forEach((line, lineIndex) => {
      context.burnedIn(
        index,
        label[lineIndex] ?? '',
        (['name', 'id', 'dob'] as const)[lineIndex] ?? 'name',
        toBox(
          40 + line.left * image.scale,
          info.bottom + line.top * image.scale,
          line.width * image.scale,
          line.height * image.scale
        )
      )
    })
    context.add(
      'paragraph',
      context.wrap(
        'Findings: The lungs are clear. Heart size is normal. No pleural effusion or pneumothorax. Impression: no acute cardiopulmonary abnormality.',
        10,
        210
      ),
      { x: 360, y: info.bottom }
    )
    return
  }

  const note = context.add(
    'paragraph',
    context.wrap(
      `${person} returns for review of a pigmented lesion on the left forearm, first noted on ${date}. The lesion is stable in size and color. No change in symptoms.`,
      10,
      520
    ),
    { y: top }
  )
  const photo = await placeImage(
    context,
    await readFile(new URL('skin-lesion.jpg', assets)),
    40,
    note.bottom,
    240
  )
  context.figure('clinicalPhoto', 'keep', photo.box)
  const caption = context.add(
    'paragraph',
    [`Figure 1. Left forearm, ${date}`],
    {
      y: note.bottom + photo.height + 4,
      size: 8,
    }
  )
  iconLines(context, caption.bottom + 6, [
    ['phone', `Clinic line: ${phone}`],
    ['calendar', 'Follow-up: 2026-05-10'],
  ])
}
