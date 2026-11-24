import type { ChatMessage } from '@repo/ai/chat'
import type { ReactNode } from 'react'
import { CitationContext } from '#lib/citation-context'
import { citationNumbers } from '#lib/citations'
import { noteExcerpts } from '#lib/note-excerpts'
import type { DocumentRef } from '#lib/page-context'

/** Numbers one message's page citations and resolves their file names and note excerpts. */
export function MessageCitations({
  parts,
  documents,
  children,
}: {
  parts: ChatMessage['parts']
  documents: DocumentRef[]
  children: ReactNode
}) {
  const text = parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
  // Excerpts come from this message's own note searches, so a citation only previews text the answer saw.
  const excerpts = noteExcerpts(
    parts.flatMap((part) =>
      part.type === 'tool-searchNotes' && part.state === 'output-available'
        ? part.output.chunks
        : []
    )
  )

  return (
    <CitationContext
      value={{ numbers: citationNumbers(text), documents, excerpts }}
    >
      {children}
    </CitationContext>
  )
}
