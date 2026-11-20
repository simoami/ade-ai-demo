import { documentPageImages } from '#lib/record-mapping'
import type { DocumentStatus } from '#lib/records-types'

/** Page URLs and the privacy warning required by the review viewer. */
export type DocumentPages = { pageImages: string[]; unredacted: boolean }

/** Selects temporary renders during OCR/redaction, then burned redacted pages. */
export function documentPages(
  id: string,
  status: DocumentStatus,
  pages: number
): DocumentPages {
  if (pages > 0 && (status === 'reading' || status === 'redacting')) {
    return {
      pageImages: Array.from(
        { length: pages },
        (_, index) => `/api/files/documents/${id}/render/${index + 1}.png`
      ),
      unredacted: true,
    }
  }

  return {
    pageImages: documentPageImages(id, status, pages),
    unredacted: false,
  }
}
