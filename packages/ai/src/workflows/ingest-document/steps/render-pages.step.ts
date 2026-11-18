import { join } from 'node:path'
import { logger } from '@repo/logger'
import { artifactDirectory } from '#local-artifacts'
import { renderPdf } from '#stages/render/render-pages'

/** Renders document artifacts and logs aggregate rendering metadata. */
export async function renderPages(documentId: string) {
  'use step'

  const directory = artifactDirectory(documentId)
  const result = await renderPdf(join(directory, 'original.pdf'), directory)

  logger.getSubLogger({ name: 'pipeline' }).info(
    {
      documentId,
      pageCount: result.pages.length,
      durationMs: Math.round(result.totalMs),
    },
    'Render completed'
  )

  return { documentId }
}
