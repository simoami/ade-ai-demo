import { join } from 'node:path'
import { artifactDirectory } from '../../../local-artifacts'
import { renderPdf } from '../../../stages/render/render-pages'

export async function renderPages(documentId: string) {
  'use step'

  const directory = artifactDirectory(documentId)
  await renderPdf(join(directory, 'original.pdf'), directory)

  return { documentId }
}
