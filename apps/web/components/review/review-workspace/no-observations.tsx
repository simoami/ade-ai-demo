import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { ClipboardX } from 'lucide-react'
import type { ReviewDocument } from '#lib/records-types'

/** Empty state explaining why a processed document has no observations. */
export function NoObservations({
  documentClass,
}: {
  documentClass: ReviewDocument['documentClass']
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardX />
        </EmptyMedia>
        <EmptyTitle>No observations</EmptyTitle>
        <EmptyDescription>
          {documentClass === 'clinical'
            ? 'No labs, vitals, events, history or medications were found in this document.'
            : 'Observations are extracted from clinical documents only.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
