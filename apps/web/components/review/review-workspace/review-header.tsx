import { Button } from '@repo/ui/components/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import type { DocumentStatus, ReviewDocument } from '#lib/records-types'

/** Back link, document identity and current review status. */
export function ReviewHeader({
  document,
  status,
}: {
  document: ReviewDocument
  status: DocumentStatus
}) {
  return (
    <header className="flex min-h-[83px] shrink-0 items-center gap-3 border-b bg-card px-6 py-3">
      <Button
        variant="outline"
        size="icon-lg"
        className="size-8 shrink-0 rounded-md border bg-card p-0 text-muted-foreground"
        aria-label="Back to documents"
        nativeButton={false}
        render={<Link href="/documents" />}
      >
        <ArrowLeft />
      </Button>
      <div className="min-w-0 [&_h1]:mt-1 [&_h1]:mb-1 [&_h1]:text-[15px] [&_h1]:font-semibold">
        <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
          DOCUMENT REVIEW · {document.id}
        </div>
        <h1 className="flex items-center gap-2">
          {document.fileName}
          <StatusBadge status={status} />
        </h1>
        <span className="text-[9.5px] text-muted-foreground capitalize">
          {document.documentClass ?? 'Pending classification'} ·{' '}
          {document.pages} pages · uploaded {formatDate(document.uploadedAt)}
        </span>
      </div>
    </header>
  )
}
