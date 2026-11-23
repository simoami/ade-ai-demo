import type { ChatMessage } from '@repo/ai/chat'

type NoteSearchOutput = Extract<
  ChatMessage['parts'][number],
  { type: 'tool-searchNotes' }
>['output']

const EXCERPT_LENGTH = 200

/** Key shared by note chunks and page citations, e.g. `doc-1:3` for page 3 of `doc-1`. */
export const pageKey = (documentId: string, page: number) =>
  `${documentId}:${page}`

/** Keep the best-ranked chunk per cited page as its section and a whitespace-collapsed excerpt of at most 200 characters. */
export function noteExcerpts(chunks: NonNullable<NoteSearchOutput>['chunks']) {
  const excerpts = new Map<string, { section: string | null; text: string }>()

  // Search returns chunks best-first, so the first chunk seen for a page wins.
  for (const chunk of chunks) {
    const key = pageKey(chunk.documentId, chunk.page)
    if (excerpts.has(key)) continue

    const text = chunk.text.replace(/\s+/g, ' ').trim()

    excerpts.set(key, {
      section: chunk.section,
      text:
        text.length > EXCERPT_LENGTH
          ? `${text.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`
          : text,
    })
  }

  return excerpts
}
