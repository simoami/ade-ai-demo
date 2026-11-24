import { Badge } from '@repo/ui/components/badge'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { PendingDot } from './pending-dot.tsx'

/** The review side panel's tabs. */
export type ReviewTab = 'general' | 'observations'

/** General and Observations tabs with pending markers and the observation count. */
export function ReviewTabs({
  tab,
  onTabChange,
  generalPending,
  observationsPending,
  observationCount,
}: {
  tab: ReviewTab
  onTabChange: (tab: ReviewTab) => void
  generalPending: boolean
  observationsPending: boolean
  observationCount: number | null
}) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as ReviewTab)}
      className="h-[43px] shrink-0 border-b px-3 [&_[data-slot=tabs-list]]:h-full"
    >
      <TabsList variant="line" className="w-full">
        <TabsTrigger
          className="px-1 text-xs data-active:text-primary"
          value="general"
        >
          General
          {generalPending ? <PendingDot /> : null}
        </TabsTrigger>
        <TabsTrigger
          className="px-1 text-xs data-active:text-primary"
          value="observations"
        >
          Observations
          {observationCount !== null && (
            <Badge variant="secondary" className="tabular-nums">
              {observationCount}
            </Badge>
          )}
          {observationsPending ? <PendingDot /> : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
