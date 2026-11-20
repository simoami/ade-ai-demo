import type { ReviewAction } from '@repo/ai/review-action'
import type {
  DocumentStatus,
  Observation,
  Redaction,
  ReviewDocument,
} from './records-types.ts'

/** A reviewer's decision on one redaction or observation. */
export type Decision = 'accepted' | 'rejected'

/** A patient link submitted but not yet visible in server data. */
export type LinkOverride = { patientId: string } | { create: true }

/** Decisions, link and terminal outcome submitted from this page and not yet read back. */
export type ReviewOverrides = {
  decisions: Record<string, Decision>
  link: LinkOverride | null
  outcome: 'reviewed' | 'discarded' | null
}

type ServerReview = Pick<
  ReviewDocument,
  'status' | 'patientId' | 'identityMismatch' | 'redactions' | 'observations'
>

/** Shows submitted decisions over server items until the service records them. */
export function withDecisions<Item extends Redaction | Observation>(
  items: Item[],
  decisions: ReviewOverrides['decisions']
): Item[] {
  return items.map((item) => {
    const decision = decisions[item.id]
    return decision ? { ...item, state: decision } : item
  })
}

/** A strong automatic link or any reviewer link counts; a partial match must be resolved. */
export function isLinked(
  document: Pick<ServerReview, 'patientId' | 'identityMismatch'>,
  link: LinkOverride | null
) {
  return (
    link !== null || (document.patientId !== null && !document.identityMismatch)
  )
}

/** True while server data lags behind a submitted action, which the workflow applies asynchronously. */
export function isSyncing(document: ServerReview, overrides: ReviewOverrides) {
  const items = [...document.redactions, ...document.observations]
  const linkPending =
    overrides.link !== null &&
    (document.identityMismatch ||
      ('patientId' in overrides.link
        ? document.patientId !== overrides.link.patientId
        : document.patientId === null))

  return (
    linkPending ||
    (overrides.outcome !== null && document.status !== overrides.outcome) ||
    Object.entries(overrides.decisions).some(
      ([id, decision]) =>
        items.find((item) => item.id === id)?.state !== decision
    )
  )
}

/** Mark as reviewed uses recorded server state, so the service never refuses it for a lagging decision. */
export function canMarkReviewed(
  document: ServerReview,
  overrides: ReviewOverrides
) {
  return (
    document.status === 'needsReview' &&
    !isSyncing(document, overrides) &&
    isLinked(document, null) &&
    [...document.redactions, ...document.observations].every(
      (item) => item.state !== 'needsReview'
    )
  )
}

/** Discard is the only action on unsupported documents. */
export function canDiscard(status: DocumentStatus) {
  return status === 'needsReview' || status === 'unsupported'
}

/** Posts one review action; returns an inline error message, or null once the service accepts it. */
export async function submitReview(
  documentId: string,
  action: ReviewAction,
  send: typeof fetch = fetch
): Promise<string | null> {
  try {
    const response = await send(`/api/documents/${documentId}/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(action),
    })
    if (response.ok) return null
    if (response.status !== 409)
      return 'The change could not be saved. Try again.'

    const body: unknown = await response.json().catch(() => null)
    return typeof body === 'object' &&
      body !== null &&
      'refusal' in body &&
      body.refusal === 'reviewIncomplete'
      ? 'Link a patient and resolve every item that needs review first.'
      : 'This change no longer applies. Refresh to see the current review.'
  } catch {
    return 'The change could not be saved. Try again.'
  }
}
