import { Card } from '@repo/ui/components/card'
import { AlertCircle, CheckCircle2, Inbox, Layers } from 'lucide-react'
import type { DocumentSummary } from '#lib/records-types'

/** Displays pipeline counts from the current document snapshot. */
export function DocumentStats({ documents }: { documents: DocumentSummary[] }) {
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
  )
}
