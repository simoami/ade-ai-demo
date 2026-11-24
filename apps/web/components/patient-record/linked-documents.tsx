import { Card } from '@repo/ui/components/card'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import type { DocumentSummary } from '#lib/records-types'

/** Every document linked to the patient, each row linking to its review. */
export function LinkedDocuments({
  documents,
}: {
  documents: DocumentSummary[]
}) {
  return (
    <Card render={<section />}>
      <div className="flex items-center justify-between px-4.5 pt-4.5 pb-3.5 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold">
        <div>
          <h2>Documents</h2>
          <span className="text-[10px] text-muted-foreground">
            All records linked to this patient
          </span>
        </div>
      </div>
      <ul className="px-4 pb-3">
        {documents.map((document) => (
          <li
            key={document.id}
            className="relative flex min-h-14 items-center gap-2.5 border-t hover:bg-muted/50"
          >
            <span className="grid h-8 w-7.5 shrink-0 place-items-center rounded border bg-accent/30 text-primary/70">
              <FileText size={16} />
            </span>
            <div className="min-w-0 flex-1 [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-semibold [&_span]:mt-1 [&_span]:block [&_span]:text-[9px] [&_span]:text-muted-foreground">
              <strong>
                <Link
                  href={`/documents/${document.id}`}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {document.fileName}
                </Link>
              </strong>
              <span>
                {formatDate(document.uploadedAt)} · {document.pages} pages ·{' '}
                {document.documentClass ?? 'Pending classification'}
              </span>
            </div>
            <StatusBadge status={document.status} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
