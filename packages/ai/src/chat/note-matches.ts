/** Maximum number of relevant note chunks returned to the model. */
export const noteMatchLimit = 4

// Similarity below 0.3 is too weak to ground a note answer (cosine distance = 1 - similarity).
const maximumDistance = 0.7

/** Keep the nearest relevant matches, bounded independently of the database query. */
export function selectNoteMatches<T extends { distance: number }>(
  rows: T[]
): T[] {
  return rows
    .filter(
      ({ distance }) => Number.isFinite(distance) && distance <= maximumDistance
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, noteMatchLimit)
}
