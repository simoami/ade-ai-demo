import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Observation, Redaction } from './records-types.ts'
import {
  canDiscard,
  canMarkReviewed,
  isLinked,
  isSyncing,
  type ReviewOverrides,
  submitReview,
  withDecisions,
} from './review-state.ts'

const box = { x: 0, y: 0, width: 0.1, height: 0.1 }
const redaction: Redaction = {
  id: 'r1',
  page: 1,
  category: 'name',
  box,
  points: [],
  state: 'needsReview',
}
const observation: Observation = {
  id: 'o1',
  documentId: 'document',
  valueNumeric: 6.1,
  details: {},
  page: 1,
  kind: 'lab',
  name: 'HbA1c',
  value: '6.1',
  unit: '%',
  date: '',
  box,
  state: 'extracted',
}
const none: ReviewOverrides = { decisions: {}, link: null, outcome: null }

function review(overrides: Partial<Parameters<typeof isSyncing>[0]> = {}) {
  return {
    status: 'needsReview' as const,
    patientId: 'PT-1042',
    identityMismatch: false,
    redactions: [redaction],
    observations: [observation],
    ...overrides,
  }
}

test('shows submitted decisions over server items', () => {
  assert.equal(
    withDecisions([redaction], { r1: 'rejected' })[0]?.state,
    'rejected'
  )
  assert.equal(withDecisions([redaction], {})[0]?.state, 'needsReview')
})

test('treats partial matches as unlinked until a reviewer links a patient', () => {
  assert.equal(isLinked(review(), null), true)
  assert.equal(isLinked(review({ identityMismatch: true }), null), false)
  assert.equal(isLinked(review({ patientId: null }), { create: true }), true)
})

test('keeps syncing until the server records each submitted action', () => {
  const decided = { ...none, decisions: { r1: 'accepted' as const } }
  assert.equal(isSyncing(review(), decided), true)
  assert.equal(
    isSyncing(
      review({ redactions: [{ ...redaction, state: 'accepted' }] }),
      decided
    ),
    false
  )

  const linked = { ...none, link: { patientId: 'PT-2210' } }
  assert.equal(isSyncing(review(), linked), true)
  assert.equal(isSyncing(review({ patientId: 'PT-2210' }), linked), false)

  const created = { ...none, link: { create: true as const } }
  assert.equal(isSyncing(review({ patientId: null }), created), true)
  assert.equal(isSyncing(review({ patientId: 'PT-NEW' }), created), false)

  const discarded = { ...none, outcome: 'discarded' as const }
  assert.equal(isSyncing(review(), discarded), true)
  assert.equal(isSyncing(review({ status: 'discarded' }), discarded), false)
})

test('enables mark as reviewed only from recorded server state', () => {
  const resolved = review({
    redactions: [{ ...redaction, state: 'accepted' }],
  })
  assert.equal(canMarkReviewed(resolved, none), true)
  assert.equal(canMarkReviewed(review(), none), false)
  assert.equal(
    canMarkReviewed(review(), { ...none, decisions: { r1: 'accepted' } }),
    false
  )
  assert.equal(
    canMarkReviewed({ ...resolved, identityMismatch: true }, none),
    false
  )
  assert.equal(
    canMarkReviewed(
      { ...resolved, observations: [{ ...observation, state: 'needsReview' }] },
      none
    ),
    false
  )
})

test('allows discard only during review and for unsupported documents', () => {
  assert.equal(canDiscard('needsReview'), true)
  assert.equal(canDiscard('unsupported'), true)
  assert.equal(canDiscard('reviewed'), false)
})

test('posts the action and reports refusals and failures as inline messages', async () => {
  const requests: [string, RequestInit | undefined][] = []
  const respond =
    (status: number): typeof fetch =>
    async (input, init) => {
      requests.push([String(input), init])
      return new Response(null, { status })
    }

  assert.equal(
    await submitReview('doc', { type: 'discard' }, respond(202)),
    null
  )
  assert.deepEqual(requests[0], [
    '/api/documents/doc/review',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"type":"discard"}',
    },
  ])
  assert.match(
    (await submitReview('doc', { type: 'markReviewed' }, respond(409))) ?? '',
    /no longer applies/
  )
  assert.match(
    (await submitReview('doc', { type: 'markReviewed' }, respond(503))) ?? '',
    /could not be saved/
  )
  assert.match(
    (await submitReview('doc', { type: 'discard' }, async () => {
      throw new TypeError('offline')
    })) ?? '',
    /could not be saved/
  )
})

test('explains incomplete review and uses the generic conflict message for other refusals', async () => {
  for (const refusal of [
    'reviewIncomplete',
    'notReviewable',
    'unknown',
    null,
    { code: 'reviewIncomplete' },
  ]) {
    assert.equal(
      await submitReview('doc', { type: 'markReviewed' }, async () =>
        Response.json({ refusal }, { status: 409 })
      ),
      refusal === 'reviewIncomplete'
        ? 'Link a patient and resolve every item that needs review first.'
        : 'This change no longer applies. Refresh to see the current review.'
    )
  }
})
