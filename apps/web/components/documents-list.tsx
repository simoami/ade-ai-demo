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
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Inbox,
  Layers,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useId, useState } from 'react'
import { StatusBadge } from '#components/status-badge'
import { UploadZone } from '#components/upload-zone'
import { filterDocuments } from '#lib/document-filters'
import { formatDate } from '#lib/format'
import { documents } from '#lib/sample-records'

const filters = ['All', 'Needs review', 'Clinical', 'Consent'] as const

/** Document operations with real counts, working filters and filename or patient search. */
export function DocumentsList() {
  const searchId = useId()
  const [filter, setFilter] = useState<(typeof filters)[number]>('All')
  const [query, setQuery] = useState('')
  const rows = filterDocuments(documents, filter, query)
  const needsReview = documents.filter(
    (document) => document.status === 'needsReview'
  ).length
  const stats = [
    {
      label: 'Processing',
      value: documents.filter((document) =>
        ['rendering', 'reading', 'redacting', 'extracting'].includes(
          document.status
        )
      ).length,
      detail: 'Documents in the pipeline',
      icon: Inbox,
    },
    {
      label: 'Needs review',
      value: needsReview,
      detail: 'Awaiting clinical review',
      icon: AlertCircle,
    },
    {
      label: 'Reviewed',
      value: documents.filter((document) => document.status === 'reviewed')
        .length,
      detail: 'Completed document reviews',
      icon: CheckCircle2,
    },
    {
      label: 'Total pages',
      value: documents.reduce((count, document) => count + document.pages, 0),
      detail: `Across ${documents.length} documents`,
      icon: Layers,
    },
  ]

  return (
    <main className="mx-auto max-w-[1500px] px-[34px] pt-[29px] pb-12 max-lg:px-[22px]">
      <header className="mb-[23px] flex items-end justify-between [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-[25px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_p]:text-xs [&_p]:text-muted-foreground">
        <div>
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            <span className="mr-1.5 mb-px inline-block size-1.5 rounded-full bg-primary" />
            DOCUMENT OPERATIONS
          </div>
          <h1>Documents</h1>
          <p>Review, redact, and organize incoming clinical records.</p>
        </div>
      </header>
      <div className="mb-4 grid grid-cols-2 gap-[13px] lg:grid-cols-4">
        {stats.map(({ label, value, detail, icon: Icon }) => (
          <Card
            className="min-h-[91px] px-[15px] py-[13px] [&>strong]:mt-2 [&>strong]:block [&>strong]:text-[22px] [&>strong]:leading-none [&>strong]:font-semibold"
            key={label}
          >
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>{label}</span>
              <Icon size={16} />
            </div>
            <strong>{value}</strong>
            <span className="mt-2 block text-[9.5px] text-muted-foreground">
              {detail}
            </span>
          </Card>
        ))}
      </div>
      <UploadZone />
      <section className="mt-6 overflow-hidden rounded-lg border bg-card">
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
              {rows.map((document) => (
                <TableRow key={document.id} className="relative">
                  <TableCell>
                    <div className="flex items-center gap-2.5 [&_strong]:block [&_strong]:text-[11px] [&_strong]:font-semibold [&_strong]:text-foreground [&_span]:text-[10px] [&_i]:mx-1 [&_i]:not-italic">
                      <span className="grid h-8 w-[30px] shrink-0 place-items-center rounded border bg-accent/30 text-primary/70">
                        <FileText size={16} />
                      </span>
                      <div>
                        <strong>
                          <Link
                            href={`/documents/${document.id}`}
                            className="after:absolute after:inset-0"
                          >
                            {document.fileName}
                          </Link>
                        </strong>
                        <span>
                          {document.id} <i>·</i>{' '}
                          {formatDate(document.uploadedAt)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {document.patientId ? (
                      <Link
                        href={`/patients/${document.patientId}`}
                        className="relative z-10 text-[11px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        {document.patientId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Not linked</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] capitalize">
                      {document.documentClass}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {document.pages}{' '}
                    <span>{document.pages === 1 ? 'page' : 'pages'}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={document.status} />
                  </TableCell>
                  <TableCell className="text-[10px]">
                    {formatDate(document.uploadedAt)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-9 text-muted-foreground">
                      <Search size={18} />
                      <strong>No documents found</strong>
                      <span>Try another search or filter.</span>
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
      </section>
    </main>
  )
}
