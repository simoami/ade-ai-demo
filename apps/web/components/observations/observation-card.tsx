import type { ObservationView } from '@repo/ai/chat'
import { Badge } from '@repo/ui/components/badge'
import { Card } from '@repo/ui/components/card'
import Link from 'next/link'

/** Integration placeholder: replace with agent B's domain-specific shared card. */
export function ObservationCard({
  observation,
}: {
  observation: ObservationView
}) {
  return (
    <Card>
      <div className="space-y-2 p-3">
        <p className="font-medium">{observation.name}</p>
        <p>
          {observation.value} {observation.unit}
        </p>
        {observation.state !== 'accepted' && (
          <Badge variant="outline">Unverified</Badge>
        )}
        <Link
          className="block text-primary underline"
          href={`/documents/${encodeURIComponent(observation.documentId)}?page=${observation.page}`}
        >
          {observation.documentId} · page {observation.page}
        </Link>
      </div>
    </Card>
  )
}
