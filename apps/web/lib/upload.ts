const maxPages = 30

const maxBytes = 20 * 1024 * 1024

const imageTypes = ['image/png', 'image/jpeg']

type Selected = { type: string; size: number }

/** Checks a selection against the upload rule: one PDF, or up to 30 PNG or JPEG pages, 20 MB in total. */
export function uploadError(files: readonly Selected[]): string | null {
  if (files.length === 0) return 'Choose a file to upload.'

  const isPdf = files.length === 1 && files[0]?.type === 'application/pdf'
  const areImages = files.every((file) => imageTypes.includes(file.type))
  if (!isPdf && !areImages)
    return 'Choose one PDF, or PNG and JPEG images only.'
  if (files.length > maxPages) return `Choose at most ${maxPages} images.`

  const total = files.reduce((sum, file) => sum + file.size, 0)
  return total > maxBytes ? 'Uploads are limited to 20 MB in total.' : null
}
