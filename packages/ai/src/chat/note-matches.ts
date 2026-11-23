/** Maximum number of relevant note chunks returned to the model. */
export const NOTE_MATCH_LIMIT = 4

// text-embedding-3-small scores relevant passages around 0.2-0.5, so only clearly unrelated text (below 0.15) is dropped.
const MAXIMUM_DISTANCE = 0.85

/** Keep the nearest relevant matches, bounded independently of the database query. */
export function selectNoteMatches<T extends { distance: number }>(
  rows: T[]
): T[] {
  return rows
    .filter(
      ({ distance }) =>
        Number.isFinite(distance) && distance <= MAXIMUM_DISTANCE
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NOTE_MATCH_LIMIT)
}
