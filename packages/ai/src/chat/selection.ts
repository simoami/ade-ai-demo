import { observationKind } from '@repo/db'
import type { ObservationView } from './tools.ts'

/** Most cards one observation query shows; the prompt and tool description state the same bound. */
export const OBSERVATION_CARD_LIMIT = 20

// Clinical reading order for cards, unlike the enum's storage order.
const KIND_ORDER: ObservationView['kind'][] = [
  'lab',
  'vital',
  'adverse-event',
  'medical-history',
  'medication',
  'symptom',
]

function outOfRange(row: ObservationView) {
  return (
    row.kind === 'lab' &&
    ['low', 'high', 'abnormal'].includes(row.details.flagNormalized ?? '')
  )
}

function unverified(row: ObservationView) {
  return row.state === 'extracted' || row.state === 'needsReview'
}

/**
 * Summarize the full matching set and select bounded, deterministic clinical cards.
 * `named` queries (one printed name) return its latest results chronologically instead of one card per series.
 */
export function observationQueryResult(
  rows: ObservationView[],
  { named = false }: { named?: boolean } = {}
) {
  const active = rows.filter((row) => row.state !== 'rejected')
  // { lab: 0, vital: 0, ... } with one counter per stored kind.
  const byKind = Object.fromEntries(
    observationKind.enumValues.map((kind) => [kind, 0])
  ) as Record<ObservationView['kind'], number>
  const summary = { total: active.length, byKind, outOfRange: 0, unverified: 0 }
  for (const row of active) {
    byKind[row.kind] += 1
    summary.outOfRange += Number(outOfRange(row))
    summary.unverified += Number(unverified(row))
  }

  const newest = [...active].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  )
  const latest = new Map<string, ObservationView>()
  for (const row of newest) {
    const key = JSON.stringify([
      row.kind,
      row.details.code ?? row.name,
      row.unit,
    ])
    if (!latest.has(key)) latest.set(key, row)
  }

  const observations = named
    ? newest
        .slice(0, OBSERVATION_CARD_LIMIT)
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
        )
    : [...latest.values()]
        .sort(
          (a, b) =>
            Number(outOfRange(b)) - Number(outOfRange(a)) ||
            Number(unverified(b)) - Number(unverified(a)) ||
            KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id)
        )
        .slice(0, OBSERVATION_CARD_LIMIT)

  return {
    summary,
    observations,
    truncated: active.length > observations.length,
  }
}
