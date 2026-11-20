import { createReadSigner } from '@repo/storage'
import type { DocumentStatus, PageImage } from '#lib/records-types'

/** Signs ordered page pairs, preferring published redactions over temporary renders. */
export async function documentPages(
  id: string,
  status: DocumentStatus,
  dimensions: { width: number; height: number }[],
  version: number | null,
  createSigner = createReadSigner
): Promise<{ pageImages: PageImage[] }> {
  if (version === null && status !== 'reading' && status !== 'redacting') {
    return { pageImages: [] }
  }

  const sign = await createSigner()
  return {
    pageImages: await Promise.all(
      dimensions.map(async (size, index) => {
        const base = `documents/${id}/${version === null ? `render/${index + 1}` : `pages/${index + 1}-v${version}`}`
        const [src, thumbnail] = await Promise.all([
          sign(`${base}.${version === null ? 'png' : 'webp'}`),
          sign(`${base}-thumb.webp`),
        ])
        return { ...size, src, thumbnail }
      })
    ),
  }
}
