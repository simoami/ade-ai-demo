import type { ObservationView } from './tools.ts'

const kindOrder = [
  'lab',
  'vital',
  'adverse-event',
  'medical-history',
  'medication',
  'symptom',
] as const

function outOfRange(row: ObservationView) {
  return (
    row.kind === 'lab' &&
    ['low', 'high', 'abnormal'].includes(row.details.flagNormalized ?? '')
  )
}

function unverified(row: ObservationView) {
  return row.state === 'extracted' || row.state === 'needsReview'
}

/** Summarize the full matching set and select bounded, deterministic clinical cards. */
export function observationQueryResult(rows: ObservationView[], named = false) {
  const active = rows.filter((row) => row.state !== 'rejected')
  const byKind = {
    lab: 0,
    vital: 0,
    'adverse-event': 0,
    'medical-history': 0,
    medication: 0,
    symptom: 0,
  }
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
    const key = JSON.stringify([row.kind, row.name.toLowerCase()])
    if (!latest.has(key)) latest.set(key, row)
  }

  const observations = named
    ? newest
        .slice(0, 20)
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
        )
    : [...latest.values()]
        .sort(
          (a, b) =>
            Number(outOfRange(b)) - Number(outOfRange(a)) ||
            Number(unverified(b)) - Number(unverified(a)) ||
            kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id)
        )
        .slice(0, 20)

  return {
    summary,
    observations,
    truncated: active.length > observations.length,
  }
}
