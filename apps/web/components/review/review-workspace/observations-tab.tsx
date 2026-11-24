import type { ComponentProps, ReactNode } from 'react'
import { ObservationTrend } from '#components/observations/observation-trend'
import type { ReviewDocument } from '#lib/records-types'
import { ExtractingObservations } from './extracting-observations.tsx'
import { NoObservations } from './no-observations.tsx'

/** Exactly one observations-tab state: still extracting, nothing found, or the list under the selected trend. */
export function ObservationsTab({
  view,
  documentClass,
  trend,
  children,
}: {
  view: 'processing' | 'empty' | 'list'
  documentClass: ReviewDocument['documentClass']
  trend: ComponentProps<typeof ObservationTrend> | undefined
  children: ReactNode
}) {
  if (view === 'processing') return <ExtractingObservations />
  if (view === 'empty') return <NoObservations documentClass={documentClass} />

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {trend ? <ObservationTrend {...trend} /> : null}
      {children}
    </div>
  )
}
