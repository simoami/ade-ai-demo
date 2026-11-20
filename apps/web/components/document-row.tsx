import { TableCell, TableRow } from '@repo/ui/components/table'
import { FileText } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import type { DocumentSummary } from '#lib/records-types'

/** Renders document links and metadata on the server for the filter leaf. */
export function DocumentRow({ document }: { document: DocumentSummary }) {
  return (
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
              {document.id} <i>·</i> {formatDate(document.uploadedAt)}
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
          {document.documentClass ?? 'Pending classification'}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">
        {document.pages} <span>{document.pages === 1 ? 'page' : 'pages'}</span>
      </TableCell>
      <TableCell>
        <StatusBadge status={document.status} />
      </TableCell>
      <TableCell className="text-[10px]">
        {formatDate(document.uploadedAt)}
      </TableCell>
    </TableRow>
  )
}
