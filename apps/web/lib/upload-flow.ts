import { startResultSchema } from '@repo/ai/review-action'
import { uploadError } from '#lib/upload'

type UploadResult = { fileName: string } & (
  | { documentId: string; failed: false }
  | { failed: true }
)

/** Uploads each file as its own document, one after another, and reports per-file outcomes. */
export async function uploadDocuments(
  files: File[],
  uploadFile: (
    file: File,
    progress: (percentage: number) => void
  ) => Promise<string>,
  onProgress: (percentage: number) => void,
  send: typeof fetch = fetch
): Promise<UploadResult[]> {
  const invalid = uploadError(files)
  if (invalid) throw new Error(invalid)

  const results: UploadResult[] = []

  for (const [index, file] of files.entries()) {
    try {
      const pathname = await uploadFile(file, (percentage) =>
        onProgress(Math.round((index * 100 + percentage) / files.length))
      )
      const response = await send('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, pathnames: [pathname] }),
      })
      if (!response.ok) throw new Error('Document could not be started')

      const { documentId } = startResultSchema.parse(await response.json())
      results.push({ fileName: file.name, documentId, failed: false })
    } catch {
      results.push({ fileName: file.name, failed: true })
    }
  }

  return results
}

/** Opens a document only when the selection contained one successful file. */
export function uploadDestination(
  results: readonly UploadResult[]
): string | null {
  const first = results[0]
  return results.length === 1 && first && !first.failed
    ? `/documents/${first.documentId}`
    : null
}

/** Summarizes completed uploads and names failed files without exposing service errors. */
export function uploadSummary(results: readonly UploadResult[]): string {
  const failed = results.filter((result) => result.failed)
  return failed.length
    ? `Uploaded ${results.length - failed.length} of ${results.length}; ${failed.length} failed: ${failed.map((result) => result.fileName).join(', ')}. Please try again.`
    : `${results.length} documents uploading`
}
