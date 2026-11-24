import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@repo/ui/components/empty'
import { Hourglass } from 'lucide-react'

/** Placeholder while the document is still being read and redacted. */
export function ExtractingObservations() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Hourglass />
        </EmptyMedia>
        <EmptyTitle>Extracting observations</EmptyTitle>
        <EmptyDescription>
          Observations appear here once the document has been read and redacted.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
