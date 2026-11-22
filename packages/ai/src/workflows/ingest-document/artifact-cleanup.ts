import { storage } from '@repo/storage'
import { findDocument } from './document-store.ts'

type ArtifactStorage = Pick<typeof storage, 'list' | 'delete'>

type Dependencies = {
  storage: ArtifactStorage
  find: (
    id: string
  ) => Promise<
    | Pick<
        NonNullable<Awaited<ReturnType<typeof findDocument>>>,
        'status' | 'pageVersion' | 'originalPathname'
      >
    | undefined
  >
}

/** Selects document artifacts other than the currently published redacted page pairs. */
export function selectArtifactDeletions(
  documentId: string,
  version: number | null,
  pathnames: string[]
) {
  const prefix = `documents/${documentId}/`

  return pathnames.filter((pathname) => {
    if (!pathname.startsWith(prefix)) return false

    const page = /^pages\/(\d+)-v(\d+)(-thumb)?\.webp$/.exec(
      pathname.slice(prefix.length)
    )

    return !(page && Number(page[1]) > 0 && page[2] === String(version))
  })
}

/** Deletes obsolete artifacts across every listing page; missing blobs are safe to retry. */
export async function deleteObsoleteArtifacts(
  documentId: string,
  version: number | null,
  prefixes: string[],
  blobs: ArtifactStorage = storage
) {
  let deleted = 0

  for (const prefix of prefixes) {
    let cursor: string | undefined

    do {
      const result = await blobs.list(prefix, cursor)
      const obsolete = selectArtifactDeletions(
        documentId,
        version,
        result.blobs.map(({ pathname }) => pathname)
      )

      if (obsolete.length) await blobs.delete(obsolete)
      deleted += obsolete.length
      cursor = result.hasMore ? result.cursor : undefined
    } while (cursor)
  }

  return deleted
}

/** Removes terminal document artifacts and originals while retaining published pages for the UI. */
export async function cleanupDocumentArtifacts(
  documentId: string,
  pathnames: string[],
  deps: Dependencies = { storage, find: findDocument }
) {
  const document = await deps.find(documentId)

  if (!document) throw new Error('Document not found')
  if (document.status !== 'reviewed' && document.status !== 'discarded')
    throw new Error('Document is not terminal')

  const originals = [...new Set([...pathnames, document.originalPathname])]

  await deps.storage.delete(originals)

  return (
    originals.length +
    (await deleteObsoleteArtifacts(
      documentId,
      document.pageVersion,
      [`documents/${documentId}/`],
      deps.storage
    ))
  )
}
