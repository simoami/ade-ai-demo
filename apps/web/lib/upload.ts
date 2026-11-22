const maxFiles = 10

const maxBytes = 20 * 1024 * 1024

const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg']

type Selected = { name: string; type: string; size: number }

/** Checks file types, the per-file size limit and the selection count. */
export function uploadError(files: readonly Selected[]): string | null {
  if (files.length === 0) return 'Choose a file to upload.'
  if (files.length > maxFiles) return `Choose at most ${maxFiles} files.`

  for (const file of files) {
    if (!allowedTypes.includes(file.type))
      return `${file.name}: unsupported file type (${file.type || 'unknown'}). Choose PDF, PNG or JPEG.`
    if (file.size > maxBytes)
      return `${file.name} exceeds the 20 MB file limit.`
  }

  return null
}
