import { Card } from '@repo/ui/components/card'
import { ObservationTrend } from '#components/observations/observation-trend'
import type { observationTrends } from '#lib/observations'

/** One chart per lab or vital series, or a note when none has enough points. */
export function PatientTrends({
  trends,
}: {
  trends: ReturnType<typeof observationTrends>
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="Lab and vital trends">
      {trends.length === 0 ? (
        <Card render={<p />} className="p-4 text-muted-foreground">
          No lab or vital has two dated numeric observations yet.
        </Card>
      ) : (
        trends.map((trend) => (
          <ObservationTrend
            key={`${trend.kind}-${trend.name}-${trend.unit}`}
            {...trend}
          />
        ))
      )}
    </section>
  )
}
