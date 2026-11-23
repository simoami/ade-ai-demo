import type { ObservationView } from '@repo/ai/chat'

export type { ObservationView }

/** Singular and plural display names per observation kind, in clinical domain order. */
export const observationKindLabels = {
  lab: { one: 'Lab', other: 'Labs' },
  vital: { one: 'Vital', other: 'Vitals' },
  'adverse-event': { one: 'Adverse event', other: 'Adverse events' },
  'medical-history': { one: 'Medical history', other: 'Medical history' },
  medication: { one: 'Medication', other: 'Medications' },
  symptom: { one: 'Symptom', other: 'Symptoms' },
} satisfies Record<ObservationView['kind'], { one: string; other: string }>

/** Groups observations in clinical domain order without changing row order. */
export function groupObservations<T extends Pick<ObservationView, 'kind'>>(
  observations: T[]
) {
  return Object.entries(observationKindLabels)
    .map(([kind, { other: title }]) => ({
      kind,
      title,
      observations: observations.filter(
        (observation) => observation.kind === kind
      ),
    }))
    .filter((group) => group.observations.length > 0)
}

/** Uses the normalized flag first, then compares numeric results to known bounds. */
export function observationFlag(observation: ObservationView) {
  const { flagNormalized, rangeLow, rangeHigh } = observation.details
  if (flagNormalized) return flagNormalized

  const value = observation.valueNumeric
  if (value === null || !Number.isFinite(value)) return null
  if (rangeLow != null && value < rangeLow) return 'low'
  if (rangeHigh != null && value > rangeHigh) return 'high'
  return rangeLow != null || rangeHigh != null ? 'normal' : null
}

/** Builds dated numeric lab/vital series, preserving each source, marking unverified points and excluding rejected rows. */
export function observationTrends(observations: ObservationView[]) {
  const series = new Map<string, ObservationView[]>()
  for (const observation of observations) {
    if (
      !['lab', 'vital'].includes(observation.kind) ||
      observation.state === 'rejected' ||
      observation.valueNumeric === null ||
      !Number.isFinite(observation.valueNumeric) ||
      !observation.date ||
      !Number.isFinite(Date.parse(observation.date))
    )
      continue

    const key = JSON.stringify([
      observation.kind,
      observation.name,
      observation.unit,
    ])
    const rows = series.get(key) ?? []
    rows.push(observation)
    series.set(key, rows)
  }

  return [...series.values()]
    .filter((rows) => rows.length >= 2)
    .map((rows) => {
      const sorted = [...rows].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
      )
      const latest = sorted.at(-1)
      if (!latest) throw new Error('Observation trend is empty')

      return {
        kind: latest.kind,
        name: latest.name,
        unit: latest.unit,
        rangeLow: latest.details.rangeLow ?? null,
        rangeHigh: latest.details.rangeHigh ?? null,
        points: sorted.map((row) => ({
          date: row.date,
          value: Number(row.valueNumeric),
          // Same convention as the assistant's trend, so unverified points read alike in both charts.
          flag:
            [
              observationFlag(row),
              row.state === 'accepted' ? null : 'unverified',
            ]
              .filter(Boolean)
              .join('; ') || null,
          documentId: row.documentId,
          page: row.page,
        })),
      }
    })
}
