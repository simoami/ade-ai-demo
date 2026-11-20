const formatRank = { table: 0, list: 1, narrative: 2 }

type Deduplicable = {
  name: string
  effectiveDate: string | null
  sourceFormat: keyof typeof formatRank
}

/** Keeps one observation per name and date within a document, preferring table over list over narrative, then the earliest; undated observations are kept. */
export function dedupeObservations<T extends Deduplicable>(
  observations: T[]
): T[] {
  const kept = new Map<string, T>()
  for (const observation of observations) {
    if (observation.effectiveDate === null) continue
    const key = `${observation.name.trim().toLowerCase()}|${observation.effectiveDate}`
    const current = kept.get(key)
    if (
      !current ||
      formatRank[observation.sourceFormat] < formatRank[current.sourceFormat]
    )
      kept.set(key, observation)
  }

  const survivors = new Set(kept.values())
  return observations.filter(
    (observation) =>
      observation.effectiveDate === null || survivors.has(observation)
  )
}
