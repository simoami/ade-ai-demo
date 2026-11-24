import { createContext } from 'react'
import type { noteExcerpts } from '#lib/note-excerpts'
import type { DocumentRef } from '#lib/page-context'

/** One message's citation numbers, cited document names and note excerpts, read by citation links. */
export const CitationContext = createContext<{
  numbers: Map<string, number>
  documents: DocumentRef[]
  excerpts: ReturnType<typeof noteExcerpts>
}>({ numbers: new Map(), documents: [], excerpts: new Map() })
