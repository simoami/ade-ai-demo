const formatRank = { table: 0, list: 1, narrative: 2 }

type Deduplicable = {
  kind: string
  name: string
  value: string
  valueNumeric: number | null
  effectiveDate: string | null
  sourceFormat: keyof typeof formatRank
}

/** Deduplicates dated observations by kind, name and value, preferring table over list over narrative; undated observations are kept. */
export function dedupeObservations<T extends Deduplicable>(
  observations: T[]
): T[] {
  const kept = new Map<string, T>()
  for (const observation of observations) {
    if (observation.effectiveDate === null) continue
    const key = JSON.stringify([
      observation.kind,
      observation.name.trim().toLowerCase(),
      // Restatements format the same reading differently ("2.8", "2.80 g/dL"), so numbers compare parsed.
      observation.valueNumeric ?? observation.value.trim().toLowerCase(),
      observation.effectiveDate,
    ])
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
