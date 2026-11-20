import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import Link from 'next/link'
import { StatusBadge } from '#components/status-badge'
import { UploadZone } from '#components/upload-zone'
import { formatDate } from '#lib/format'
import { documents, findReviewDocument } from '#lib/sample-records'

/** Document list with the upload drop zone. */
export default function DocumentsPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Uploaded documents are redacted, read and linked to a patient before
          review.
        </p>
      </header>

      <UploadZone />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Document</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="text-right">Pages</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Uploaded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="pl-4 font-medium">
                  {findReviewDocument(document.id) ? (
                    <Link
                      href={`/documents/${document.id}`}
                      className="hover:underline"
                    >
                      {document.fileName}
                    </Link>
                  ) : (
                    document.fileName
                  )}
                </TableCell>
                <TableCell className="capitalize">
                  {document.documentClass}
                </TableCell>
                <TableCell>
                  {document.patientId ? (
                    <Link
                      href={`/patients/${document.patientId}`}
                      className="hover:underline"
                    >
                      {document.patientId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {document.pages}
                </TableCell>
                <TableCell>
                  <StatusBadge status={document.status} />
                </TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground">
                  {formatDate(document.uploadedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  )
}
