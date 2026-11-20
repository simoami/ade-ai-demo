import sharp from 'sharp'
import type { RedactionRegion } from './redaction-types.ts'

/** Burns every candidate polygon into an opaque PNG without changing pixel dimensions. */
export async function burnRedactions<
  Region extends Pick<RedactionRegion, 'points'>,
>(image: Uint8Array, regions: Region[]): Promise<Buffer> {
  const { width, height } = await sharp(image).metadata()
  if (!width || !height) throw new Error('Redaction image has no dimensions')

  const polygons = regions
    .map(({ points }) => {
      if (
        points.length < 3 ||
        points.some(
          ([x, y]) =>
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            x < 0 ||
            x > 1 ||
            y < 0 ||
            y > 1
        )
      )
        throw new Error('Invalid redaction polygon')

      return `<polygon points="${points.map(([x, y]) => `${x * width},${y * height}`).join(' ')}" fill="black"/>`
    })
    .join('')
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${polygons}</svg>`
  )
  return sharp(image)
    .flatten({ background: 'white' })
    .composite([{ input: svg }])
    .png()
    .toBuffer()
}
