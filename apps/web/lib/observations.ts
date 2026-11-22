import type { Observation } from '#lib/records-types'

/** Clinical fields shared by review rows and assistant cards. */
export type ObservationView = Pick<
  Observation,
  | 'id'
  | 'documentId'
  | 'page'
  | 'kind'
  | 'name'
  | 'value'
  | 'valueNumeric'
  | 'unit'
  | 'date'
  | 'details'
  | 'state'
>

const kindLabels = {
  lab: 'Labs',
  vital: 'Vitals',
  'adverse-event': 'Adverse events',
  'medical-history': 'Medical history',
  medication: 'Medications',
  symptom: 'Symptoms',
} as const

/** Groups observations in clinical domain order without changing row order. */
export function groupObservations<T extends Pick<Observation, 'kind'>>(
  observations: T[]
) {
  return Object.entries(kindLabels)
    .map(([kind, title]) => ({
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

/** Builds dated numeric lab/vital series, preserving each source and excluding rejected rows. */
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
          flag: observationFlag(row),
          documentId: row.documentId,
          page: row.page,
        })),
      }
    })
}
