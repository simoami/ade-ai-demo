import type { Observation, Redaction } from './records-types.ts'

/** Builds page outlines, spotlighting only a selected observation regardless of polygon presence. */
export function reviewOutlines(
  redactions: Redaction[],
  observations: Observation[],
  page: number,
  selectedId: string | undefined
) {
  const observationIds = new Set(observations.map((item) => item.id))

  return [...redactions, ...observations]
    .filter((item) => item.page === page)
    .filter((item) => item.state === 'needsReview' || item.id === selectedId)
    .map((item) => ({
      id: item.id,
      box: item.box,
      points: item.points,
      spotlight: item.id === selectedId && observationIds.has(item.id),
      tone:
        item.id === selectedId ? ('selected' as const) : ('review' as const),
    }))
}
