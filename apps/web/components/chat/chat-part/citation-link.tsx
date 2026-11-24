import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@repo/ui/components/popover'
import Link from 'next/link'
import { type ComponentProps, use } from 'react'
import { defaultComponents } from 'streamdown'
import { CitationContext } from '#lib/citation-context'
import { parseCitation } from '#lib/citations'
import { pageKey } from '#lib/note-excerpts'

/** Markdown link that renders a page citation as a numbered popover with its note excerpt; other links pass through. */
export function CitationLink(
  props: ComponentProps<typeof defaultComponents.a>
) {
  const { numbers, documents, excerpts } = use(CitationContext)
  const citation = parseCitation(props.href)
  const number = props.href && numbers.get(props.href)
  if (!citation || !number) return <defaultComponents.a {...props} />

  const fileName =
    documents.find((document) => document.id === citation.documentId)
      ?.fileName ?? 'Document'
  const excerpt = excerpts.get(pageKey(citation.documentId, citation.page))

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Citation ${number}: ${fileName}, page ${citation.page}`}
        className="mx-0.5 cursor-pointer align-super text-[0.7em] leading-none font-medium tabular-nums text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
      >
        [{number}]
      </PopoverTrigger>
      <PopoverContent side="top" className="w-auto max-w-64">
        <PopoverTitle className="break-all">{fileName}</PopoverTitle>
        <p className="text-muted-foreground">
          {[excerpt?.section, `Page ${citation.page}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {excerpt && <p>{excerpt.text}</p>}
        <Link href={props.href ?? ''} className="text-primary underline">
          Open page
        </Link>
      </PopoverContent>
    </Popover>
  )
}
