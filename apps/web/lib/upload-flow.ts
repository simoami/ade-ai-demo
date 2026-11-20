import { startResultSchema } from '@repo/ai/review-action'
import { uploadError } from './upload.ts'

type UploadFile = (
  file: File,
  progress: (percentage: number) => void
) => Promise<string>

/** Uploads validated pages in order, then starts one document using the returned private pathnames. */
export async function uploadDocument(
  files: File[],
  uploadFile: UploadFile,
  onProgress: (percentage: number) => void,
  send: typeof fetch = fetch
): Promise<string> {
  const invalid = uploadError(files)
  if (invalid) throw new Error(invalid)

  const first = files[0]
  if (!first) throw new Error('Choose a file to upload.')

  const pathnames: string[] = []
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  let uploadedBytes = 0
  for (const file of files) {
    const pathname = await uploadFile(file, (percentage) => {
      onProgress(
        Math.round(
          ((uploadedBytes +
            (file.size * Math.min(100, Math.max(0, percentage))) / 100) /
            Math.max(totalBytes, 1)) *
            100
        )
      )
    })
    pathnames.push(pathname)
    uploadedBytes += file.size
  }

  const response = await send('/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileName: first.name, pathnames }),
  })
  if (!response.ok) throw new Error('Document could not be started')

  return startResultSchema.parse(await response.json()).documentId
}
