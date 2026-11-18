import { join } from 'node:path'
import { artifactDirectory } from '#local-artifacts'
import { renderPdf } from '#stages/render/render-pages'
import { log } from '#workflows/ingest-document/steps/log'

/** Renders document artifacts and logs aggregate rendering metadata. */
export async function renderPages(documentId: string) {
  'use step'

  const directory = artifactDirectory(documentId)
  const result = await renderPdf(join(directory, 'original.pdf'), directory)

  log.info(
    {
      documentId,
      pageCount: result.pages.length,
      durationMs: Math.round(result.totalMs),
    },
    'Render completed'
  )

  return { documentId }
}
