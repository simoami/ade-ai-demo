import { storage } from '@repo/storage'
import sharp from 'sharp'
import { deleteObsoleteArtifacts } from './artifact-cleanup.ts'
import { findDocument, updateDocument } from './document-store.ts'

type Dependencies = {
  storage: Pick<typeof storage, 'put' | 'list' | 'delete'>
  find: (id: string) => Promise<
    | {
        pageVersion: number | null
        pageDimensions: { width: number; height: number }[]
      }
    | undefined
  >
  update: typeof updateDocument
}

const defaults: Dependencies = {
  storage,
  find: findDocument,
  update: updateDocument,
}

/** Publishes complete redacted pairs before switching the version and deleting obsolete artifacts.
 * The document workflow must serialize calls for one document; pass only burned redacted pixels.
 */
export async function publishRedactedPages(
  documentId: string,
  pages: Buffer[],
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  const document = await deps.find(documentId)
  if (!document) throw new Error('Document not found')
  if (!pages.length || pages.length !== document.pageDimensions.length) {
    throw new Error('Redacted page count does not match document')
  }

  const version = (document.pageVersion ?? 0) + 1
  for (const [index, bytes] of pages.entries()) {
    const image = sharp(bytes)
    const full = await image.clone().webp({ quality: 70 }).toBuffer()
    const thumbnail = await image
      .clone()
      .resize({ width: 200, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
    const base = `documents/${documentId}/pages/${index + 1}-v${version}`
    for (const [pathname, body] of [
      [`${base}.webp`, full],
      [`${base}-thumb.webp`, thumbnail],
    ] as const) {
      await deps.storage.put(pathname, body, {
        contentType: 'image/webp',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
    }
  }

  await deps.update(documentId, { pageVersion: version })

  // List after the version switch so incomplete writes never remove the visible copy.
  await deleteObsoleteArtifacts(
    documentId,
    version,
    [`documents/${documentId}/render/`, `documents/${documentId}/pages/`],
    deps.storage
  )

  return version
}
