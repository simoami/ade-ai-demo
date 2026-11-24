import { Card } from '@repo/ui/components/card'
import type { DocumentSummary } from '#lib/records-types'

/** Linked document, observation and needs-review counts. */
export function PatientStats({
  documents,
  observationCount,
}: {
  documents: DocumentSummary[]
  observationCount: number
}) {
  return (
    <div className="mt-[17px] mb-[21px] grid grid-cols-1 gap-3 sm:grid-cols-3 [&>div]:flex [&>div]:min-h-[91px] [&>div]:flex-col [&>div]:gap-2 [&>div]:p-3.5 [&_span]:text-[9.5px] [&_span]:text-muted-foreground [&_strong]:text-base [&_strong]:font-semibold [&_small]:text-[9px] [&_small]:text-muted-foreground">
      <Card>
        <span>Documents</span>
        <strong>{documents.length}</strong>
        <small>Linked patient records</small>
      </Card>
      <Card>
        <span>Observations</span>
        <strong>{observationCount}</strong>
        <small>Extracted from clinical records</small>
      </Card>
      <Card>
        <span>Needs review</span>
        <strong>
          {
            documents.filter((document) => document.status === 'needsReview')
              .length
          }
        </strong>
        <small>Documents awaiting review</small>
      </Card>
    </div>
  )
}
