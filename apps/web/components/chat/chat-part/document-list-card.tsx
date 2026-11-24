import type { ChatMessage } from '@repo/ai/chat'
import { Card } from '@repo/ui/components/card'
import Link from 'next/link'

/** Documents found by the list tool, each linking to its review screen. */
export function DocumentListCard({
  documents,
}: {
  documents: Extract<
    ChatMessage['parts'][number],
    { type: 'tool-listDocuments'; state: 'output-available' }
  >['output']['documents']
}) {
  return (
    <Card render={<ul />} className="divide-y px-3">
      {documents.map((document) => (
        <li key={document.id} className="py-2">
          <Link
            href={`/documents/${encodeURIComponent(document.id)}`}
            className="text-primary underline"
          >
            {document.fileName}
          </Link>
          <p>
            {document.documentClass ?? 'Unclassified'} · {document.status}
          </p>
          <p className="text-muted-foreground">
            {document.patientId ?? 'No patient linked'} ·{' '}
            {document.createdAt.slice(0, 10)}
          </p>
        </li>
      ))}
      {documents.length === 0 && (
        <li className="py-2">No matching documents found.</li>
      )}
    </Card>
  )
}
