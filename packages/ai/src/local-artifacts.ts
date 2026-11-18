import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { documentIdSchema } from '#workflows/ingest-document/review-action'

/** Resolves the private temporary directory for a validated document ID. */
export function artifactDirectory(documentId: string): string {
  return join(tmpdir(), 'ade-documents', documentIdSchema.parse(documentId))
}

/** Persists the document-to-run mapping with owner-only permissions. */
export async function saveRun(
  documentId: string,
  runId: string
): Promise<void> {
  const directory = artifactDirectory(documentId)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await writeFile(join(directory, 'run.json'), JSON.stringify({ runId }), {
    mode: 0o600,
  })
}

/** Reads and validates the stored workflow run ID. */
export async function readRunId(documentId: string): Promise<string> {
  const data: unknown = JSON.parse(
    await readFile(join(artifactDirectory(documentId), 'run.json'), 'utf8')
  )
  return z.object({ runId: z.string().min(1) }).parse(data).runId
}
