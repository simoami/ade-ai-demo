import type { ChatMessage, PageContext } from '@repo/ai/chat'

type NoteSearchOutput = Extract<
  ChatMessage['parts'][number],
  { type: 'tool-searchNotes' }
>['output']

/** Group retrieved chunks by document and page, keeping one short excerpt per source. */
export function noteSources(
  chunks: NonNullable<NoteSearchOutput>['chunks'],
  context: PageContext
) {
  const byPage = new Map<string, (typeof chunks)[number]>()
  for (const chunk of chunks) {
    const key = `${chunk.documentId}:${chunk.page}`
    if (!byPage.has(key)) byPage.set(key, chunk)
  }
  const sources = [...byPage.values()]
  const currentDocument =
    context.page === 'document' &&
    sources.every((source) => source.documentId === context.documentId)

  return sources.map((source) => {
    const text = source.text.replace(/\s+/g, ' ').trim()

    return {
      key: `${source.documentId}:${source.page}`,
      label: currentDocument
        ? `page ${source.page}`
        : `${source.fileName}, page ${source.page}`,
      href: `/documents/${encodeURIComponent(source.documentId)}?page=${source.page}`,
      excerpt: text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text,
    }
  })
}
