import { ObservationCard } from '#components/observations/observation-card'
import type { ObservationView } from '#lib/observations'

/** Every observation for the patient, targeted by the assistant's "#observations" links. */
export function PatientObservations({
  observations,
}: {
  observations: ObservationView[]
}) {
  return (
    // biome-ignore lint/correctness/useUniqueElementIds: Stable fragment destination for the single patient page.
    <section
      id="observations"
      aria-label="Observations"
      className="mt-6 space-y-3 scroll-mt-4"
    >
      <h2 className="text-sm font-semibold">Observations</h2>
      {observations.length ? (
        observations.map((observation) => (
          <ObservationCard key={observation.id} observation={observation} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">No observations found.</p>
      )}
    </section>
  )
}
