import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encryptArtifact } from '#workflows/ingest-document/artifact-encryption'
import type { ReviewAction } from '#workflows/ingest-document/review-action'
import {
  applyReviewAction,
  checkReviewAction,
  type ReviewState,
  type ReviewWrite,
} from '#workflows/ingest-document/review-actions'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'
const flaggedRedaction = 'a1d9f1a4-6a39-5b62-9d43-2f0b1e8a7c01'
const appliedRedaction = 'a1d9f1a4-6a39-5b62-9d43-2f0b1e8a7c02'
const flaggedObservation = 'b2c8e0b3-7b48-5c71-8e52-3a1c2f9b8d01'
const coveredObservation = 'b2c8e0b3-7b48-5c71-8e52-3a1c2f9b8d02'
const key = Buffer.alloc(32, 7)
const square: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [0.5, 0.5],
]

function reviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    status: 'needsReview',
    patientId: 'PT-1042',
    identityMismatch: false,
    identifierHashes: { mrn: 'mrn-hash', lastName: 'last-hash' },
    proposedPatient: { initials: 'AB', birthYear: 1985, sex: 'Female' },
    pageCount: 2,
    redactions: [
      { id: flaggedRedaction, page: 1, points: square, state: 'needsReview' },
      { id: appliedRedaction, page: 2, points: square, state: 'applied' },
    ],
    observations: [
      {
        id: flaggedObservation,
        reviewStatus: 'flagged',
        removedByRedactionIds: [],
      },
      {
        id: coveredObservation,
        reviewStatus: 'unchecked',
        removedByRedactionIds: [flaggedRedaction],
      },
    ],
    ...overrides,
  }
}

function harness(state: ReviewState | undefined) {
  const writes: ReviewWrite[] = []
  const calls: string[] = []
  const blobs = new Map(
    [1, 2].map((page) => [
      `documents/${documentId}/redaction/source/${page}.png.enc`,
      encryptArtifact(Buffer.from(`source-${page}`), key),
    ])
  )
  const deps: NonNullable<Parameters<typeof applyReviewAction>[2]> = {
    load: async () => state,
    patientExists: async (patientId) =>
      patientId === 'PT-1042' || patientId === 'PT-2210',
    write: async (_id, write) => {
      writes.push(write)
    },
    key: () => key,
    storage: {
      get: async (path) => {
        const bytes = blobs.get(path)
        return bytes
          ? {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes)
                  controller.close()
                },
              }),
              contentType: 'application/octet-stream',
            }
          : null
      },
      put: async () => {
        throw new Error('Review actions never write Blobs')
      },
    },
    burn: async (image, regions) => {
      calls.push(`burn:${image.toString()}:${regions.length}`)
      return Buffer.from(`burned-${image.toString()}`)
    },
    publish: async (_id, pages) => {
      calls.push(`publish:${pages.map(String).join(',')}`)
      return 2
    },
  }
  return { deps, writes, calls }
}

async function apply(action: ReviewAction, state = reviewState()) {
  const h = harness(state)
  const result = await applyReviewAction(documentId, action, h.deps)
  return { ...h, result }
}

test('accepts a flagged redaction by re-burning from encrypted sources', async () => {
  const { result, writes, calls } = await apply({
    type: 'redaction.update',
    redactionId: flaggedRedaction,
    status: 'accepted',
  })
  assert.deepEqual(result, { applied: true })
  assert.deepEqual(writes, [
    {
      event: {
        action: 'redaction.update',
        payload: { redactionId: flaggedRedaction, status: 'accepted' },
      },
      redaction: { id: flaggedRedaction, state: 'accepted' },
    },
  ])
  assert.deepEqual(calls, [
    'burn:source-1:1',
    'burn:source-2:1',
    'publish:burned-source-1,burned-source-2',
  ])
})

test('re-burns every page from encrypted sources without the rejected redaction, then restores its observations', async () => {
  const { result, writes, calls } = await apply({
    type: 'redaction.update',
    redactionId: flaggedRedaction,
    status: 'rejected',
  })
  assert.deepEqual(result, { applied: true })
  assert.deepEqual(calls, [
    'burn:source-1:0',
    'burn:source-2:1',
    'publish:burned-source-1,burned-source-2',
  ])
  assert.equal(writes[0]?.restoreRedactionId, flaggedRedaction)
  assert.deepEqual(writes[0]?.redaction, {
    id: flaggedRedaction,
    state: 'rejected',
  })
})

test('keeps previously rejected redactions out of a re-burn', async () => {
  const state = reviewState()
  state.redactions = [
    { id: flaggedRedaction, page: 1, points: square, state: 'rejected' },
    { id: appliedRedaction, page: 1, points: square, state: 'applied' },
  ]
  const { calls } = await apply(
    {
      type: 'redaction.update',
      redactionId: appliedRedaction,
      status: 'rejected',
    },
    state
  )
  assert.deepEqual(calls.slice(0, 2), ['burn:source-1:0', 'burn:source-2:0'])
})

test('burns only applied and accepted redactions after either decision', async () => {
  for (const status of ['accepted', 'rejected'] as const) {
    const state = reviewState()
    const accepted = {
      id: 'accepted',
      page: 1,
      points: square,
      state: 'accepted' as const,
    }
    state.redactions.push(
      accepted,
      { id: 'pending', page: 1, points: square, state: 'needsReview' },
      { id: 'rejected', page: 1, points: square, state: 'rejected' }
    )
    const h = harness(state)
    const burned: unknown[] = []
    h.deps.burn = async (_image, regions) => {
      burned.push(regions)
      return Buffer.from('burned')
    }
    h.deps.publish = async () => {
      assert.deepEqual(h.writes, [])
      return 2
    }

    await applyReviewAction(
      documentId,
      {
        type: 'redaction.update',
        redactionId: flaggedRedaction,
        status,
      },
      h.deps
    )

    assert.deepEqual(burned, [
      status === 'accepted'
        ? [{ ...state.redactions[0], state: 'accepted' }, accepted]
        : [accepted],
      [state.redactions[1]],
    ])
    assert.equal(h.writes.length, 1)
  }
})

for (const status of ['accepted', 'rejected'] as const) {
  test(`retries ${status} decisions after publication fails without recording the decision`, async () => {
    const h = harness(reviewState())
    const action = {
      type: 'redaction.update',
      redactionId: flaggedRedaction,
      status,
    } as const
    h.deps.publish = async () => {
      throw new Error('Publication failed')
    }

    await assert.rejects(
      applyReviewAction(documentId, action, h.deps),
      /Publication failed/
    )
    assert.equal(h.writes.length, 0)

    h.deps.publish = async () => 2
    await applyReviewAction(documentId, action, h.deps)
    assert.equal(h.writes[0]?.redaction?.state, status)
    assert.equal(h.calls.filter((call) => call.startsWith('burn:')).length, 4)
  })
}

for (const status of ['accepted', 'rejected'] as const) {
  test(`fails without recording ${status} when a review source is missing`, async () => {
    const h = harness(reviewState())
    const storage = h.deps.storage
    assert.ok(storage)
    h.deps.storage = { ...storage, get: async () => null }
    await assert.rejects(
      applyReviewAction(
        documentId,
        {
          type: 'redaction.update',
          redactionId: flaggedRedaction,
          status,
        },
        h.deps
      ),
      /Missing document artifact/
    )
    assert.deepEqual(h.writes, [])
  })
}

test('refuses to reverse a rejected redaction and ignores repeated decisions', async () => {
  const state = reviewState()
  state.redactions = [
    { id: flaggedRedaction, page: 1, points: square, state: 'rejected' },
  ]
  const reversed = await apply(
    {
      type: 'redaction.update',
      redactionId: flaggedRedaction,
      status: 'accepted',
    },
    state
  )
  assert.deepEqual(reversed.result, { refusal: 'redactionRejected' })

  const repeated = await apply(
    {
      type: 'redaction.update',
      redactionId: flaggedRedaction,
      status: 'rejected',
    },
    state
  )
  assert.deepEqual(repeated.result, { applied: false })
  assert.deepEqual([...repeated.writes, ...repeated.calls], [])
})

test('refuses redactions and observations that belong to another document', async () => {
  for (const action of [
    {
      type: 'redaction.update',
      redactionId: flaggedObservation,
      status: 'accepted',
    },
    {
      type: 'observation.update',
      observationId: flaggedRedaction,
      status: 'accepted',
    },
  ] as const) {
    const { result, writes } = await apply(action)
    assert.deepEqual(result, { refusal: 'targetNotFound' })
    assert.deepEqual(writes, [])
  }
})

test('maps observation decisions to confirmed and rejected review statuses', async () => {
  for (const [status, reviewStatus] of [
    ['accepted', 'confirmed'],
    ['rejected', 'rejected'],
  ] as const) {
    const { writes } = await apply({
      type: 'observation.update',
      observationId: flaggedObservation,
      status,
    })
    assert.deepEqual(writes, [
      {
        event: {
          action: 'observation.update',
          payload: { observationId: flaggedObservation, status },
        },
        observation: { id: flaggedObservation, reviewStatus },
      },
    ])
  }
})

test('refuses decisions on observations hidden by a redaction', async () => {
  const { result } = await apply({
    type: 'observation.update',
    observationId: coveredObservation,
    status: 'accepted',
  })
  assert.deepEqual(result, { refusal: 'observationRemoved' })
})

test('links an existing patient and clears the identity mismatch', async () => {
  const { result, writes } = await apply(
    { type: 'patient.link', patientId: 'PT-2210' },
    reviewState({ identityMismatch: true })
  )
  assert.deepEqual(result, { applied: true })
  assert.deepEqual(writes[0]?.document, {
    patientId: 'PT-2210',
    identityMismatch: false,
  })
  assert.deepEqual(writes[0]?.event, {
    action: 'patient.link',
    payload: { patientId: 'PT-2210' },
  })
})

test('confirms a partial match when the reviewer links the same patient', async () => {
  const { writes } = await apply(
    { type: 'patient.link', patientId: 'PT-1042' },
    reviewState({ identityMismatch: true })
  )
  assert.deepEqual(writes[0]?.document, {
    patientId: 'PT-1042',
    identityMismatch: false,
  })
})

test('refuses links to unknown patients', async () => {
  const { result, writes } = await apply({
    type: 'patient.link',
    patientId: 'PT-9999',
  })
  assert.deepEqual(result, { refusal: 'patientNotFound' })
  assert.deepEqual(writes, [])
})

test('creates a stable patient from document hashes and the proposed demographics', async () => {
  const state = reviewState({ patientId: null })
  const first = await apply({ type: 'patient.create' }, state)
  const second = await apply({ type: 'patient.create' }, state)
  const patient = first.writes[0]?.patient
  assert.ok(patient)
  assert.match(patient.id, /^PT-[0-9A-F]{10}$/)
  assert.equal(second.writes[0]?.patient?.id, patient.id)
  assert.deepEqual(patient, {
    id: patient.id,
    mrnHash: 'mrn-hash',
    firstNameHash: null,
    lastNameHash: 'last-hash',
    birthDateHash: null,
    initials: 'AB',
    birthYear: 1985,
    sex: 'Female',
  })
  assert.deepEqual(first.writes[0]?.document, {
    patientId: patient.id,
    identityMismatch: false,
  })

  const retried = await apply(
    { type: 'patient.create' },
    reviewState({ patientId: patient.id })
  )
  assert.deepEqual(retried.result, { applied: false })
})

test('refuses patient creation without valid proposed demographics', async () => {
  for (const proposedPatient of [null, { initials: '', sex: 'Female' }]) {
    const { result } = await apply(
      { type: 'patient.create' },
      reviewState({ patientId: null, proposedPatient } as Partial<ReviewState>)
    )
    assert.deepEqual(result, { refusal: 'noProposedPatient' })
  }
})

test('refuses mark as reviewed while the link or any item still needs review', async () => {
  const resolved = reviewState({
    redactions: [],
    observations: [
      {
        id: coveredObservation,
        reviewStatus: 'flagged',
        removedByRedactionIds: [flaggedRedaction],
      },
    ],
  })
  for (const state of [
    { ...resolved, patientId: null },
    { ...resolved, identityMismatch: true },
    { ...resolved, observations: reviewState().observations },
    {
      ...resolved,
      redactions: reviewState().redactions,
      observations: [],
    },
  ]) {
    const h = harness(state)
    assert.equal(
      await checkReviewAction(documentId, { type: 'markReviewed' }, h.deps),
      'reviewIncomplete'
    )
  }

  const { result, writes, calls } = await apply(
    { type: 'markReviewed' },
    resolved
  )
  assert.deepEqual(result, { applied: true })
  assert.equal(writes[0]?.document?.status, 'reviewed')
  assert.ok(writes[0]?.document?.reviewedAt instanceof Date)
  assert.deepEqual(calls, [])
})

test('discards unsupported documents before artifact cleanup', async () => {
  const { result, writes, calls } = await apply(
    { type: 'discard' },
    reviewState({ status: 'unsupported' })
  )
  assert.deepEqual(result, { applied: true })
  assert.deepEqual(writes, [
    {
      event: { action: 'discard', payload: {} },
      document: { status: 'discarded' },
    },
  ])
  assert.deepEqual(calls, [])
})

test('does not write another event when a terminal action is retried', async () => {
  const { result, writes, calls } = await apply(
    { type: 'discard' },
    reviewState({ status: 'discarded' })
  )
  assert.deepEqual(result, { applied: false })
  assert.deepEqual(writes, [])
  assert.deepEqual(calls, [])
})

test('refuses review actions outside review and on unsupported documents', async () => {
  for (const [status, action] of [
    ['redacting', { type: 'markReviewed' }],
    ['reviewed', { type: 'discard' }],
    ['failed', { type: 'discard' }],
    ['unsupported', { type: 'patient.link', patientId: 'PT-2210' }],
  ] as const) {
    const { result, writes } = await apply(action, reviewState({ status }))
    assert.deepEqual(result, { refusal: 'notReviewable' }, status)
    assert.deepEqual(writes, [])
  }
  assert.deepEqual(
    await applyReviewAction(
      documentId,
      { type: 'discard' },
      harness(undefined).deps
    ),
    { refusal: 'targetNotFound' }
  )
})
