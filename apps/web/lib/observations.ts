import type { ObservationView } from '@repo/ai/chat'
import { trendPoint } from '@repo/ai/chat/trend-point'

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
      (!observation.details.components?.length &&
        (observation.valueNumeric === null ||
          !Number.isFinite(observation.valueNumeric))) ||
      !observation.date ||
      !Number.isFinite(Date.parse(observation.date))
    )
      continue

    const key = JSON.stringify([
      observation.kind,
      observation.details.code ?? observation.name,
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
        points: sorted.map((row) => trendPoint(row, observationFlag(row))),
      }
    })
}

type ObservationFlag = NonNullable<ReturnType<typeof observationFlag>>

/** Badge and range-marker classes per flag; in-range reads as success, out-of-range as warning. */
export const observationFlagTones: Record<
  ObservationFlag,
  { badge: string; marker: string }
> = {
  normal: { badge: 'bg-success-muted text-success', marker: 'bg-success' },
  low: { badge: 'bg-warning-muted text-warning', marker: 'bg-warning' },
  high: { badge: 'bg-warning-muted text-warning', marker: 'bg-warning' },
  abnormal: {
    badge: 'bg-destructive/10 text-destructive',
    marker: 'bg-destructive',
  },
}

/** Parsed limits as printed text: both → "3.5–5.0", one side → "≥3.5" or "≤5.0", neither → null. */
function rangeBounds(low?: number | null, high?: number | null) {
  if (low != null && high != null) return `${low}–${high}`
  if (low != null) return `≥${low}`
  if (high != null) return `≤${high}`
  return null
}

/** The printed reference range when present, otherwise one built from the parsed bounds and unit. */
export function referenceRange({ details, unit }: ObservationView) {
  if (details.referenceRange) return details.referenceRange

  const bounds = rangeBounds(details.rangeLow, details.rangeHigh)
  return bounds && unit ? `${bounds} ${unit}` : bounds
}
