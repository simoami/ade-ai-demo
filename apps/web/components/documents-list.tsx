'use client'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import { filterDocuments } from '#lib/document-filters'
import type { DocumentSummary } from '#lib/records-types'

const filters = ['All', 'Needs review', 'Clinical', 'Consent'] as const

/** Document operations with real counts, working filters and filename or patient search. */
export function DocumentsList({
  documents,
  renderedRows,
}: {
  documents: DocumentSummary[]
  renderedRows: Record<string, React.ReactNode>
}) {
  const searchId = useId()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [query, setQuery] = useState('')
  const rows = filterDocuments(documents, filter, query)
  const needsReview = documents.filter(
    (document) => document.status === 'needsReview'
  ).length

  return (
    <Card render={<section />} className="mt-6 overflow-hidden">
      <div className="flex items-center justify-between px-[18px] pt-[18px] pb-3.5 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold">
        <div>
          <h2>Recent documents</h2>
          <span className="text-[10px] text-muted-foreground">
            Your document pipeline
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-y px-3.5 py-2">
        <div className="flex items-center gap-1">
          {filters.map((item) => (
            <Button
              variant="ghost"
              type="button"
              key={item}
              aria-pressed={filter === item}
              className="h-[29px] gap-1.5 px-2.5 text-[10px] text-muted-foreground aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground"
              onClick={() => setFilter(item)}
            >
              {item}
              {item === 'Needs review' && (
                <span className="grid size-4 place-items-center rounded-full bg-warning-muted text-[8px] text-warning">
                  {needsReview}
                </span>
              )}
            </Button>
          ))}
        </div>
        <label
          htmlFor={searchId}
          className="flex h-[29px] items-center gap-2 rounded border bg-card px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring [&_input]:w-[140px] [&_input]:bg-transparent [&_input]:text-[10px] [&_input]:text-foreground [&_input]:outline-none"
        >
          <Search size={15} />
          <Input
            id={searchId}
            className="h-auto w-[140px] rounded-none border-0 bg-transparent p-0 text-[10px] focus-visible:ring-0 dark:bg-transparent"
            aria-label="Search documents"
            placeholder="Search documents…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div>
        <Table className="[&_td]:px-[18px] [&_td]:py-3 [&_td]:text-[11px] [&_td]:text-muted-foreground [&_th]:h-[35px] [&_th]:bg-muted/30 [&_th]:px-[18px] [&_th]:text-[8px] [&_th]:font-semibold [&_th]:tracking-widest [&_th]:text-muted-foreground">
          <TableHeader>
            <TableRow>
              <TableHead>DOCUMENT</TableHead>
              <TableHead>PATIENT</TableHead>
              <TableHead>TYPE</TableHead>
              <TableHead>PAGES</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead>UPLOADED</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((document) => renderedRows[document.id])}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-center gap-2 py-9 text-muted-foreground">
                    <Search size={18} />
                    <strong>
                      {documents.length === 0
                        ? 'No documents yet'
                        : 'No documents found'}
                    </strong>
                    <span>
                      {documents.length === 0
                        ? 'Upload a document to start a review.'
                        : 'Try another search or filter.'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex h-12 items-center border-t px-[18px] text-[10px] text-muted-foreground">
        <span>
          Showing <strong>{rows.length}</strong> of{' '}
          <strong>{documents.length}</strong> documents
        </span>
      </div>
    </Card>
  )
}
