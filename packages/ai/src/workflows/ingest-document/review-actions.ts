import { createHash, randomUUID } from 'node:crypto'
import {
  and,
  createDb,
  documents,
  eq,
  noteChunks,
  observations,
  patients,
  redactions,
  reviewEvents,
  sql,
} from '@repo/db'
import { storage } from '@repo/storage'
import { z } from 'zod'
import { encryptionKey } from './artifact-encryption.ts'
import { readEncrypted } from './document-artifacts.ts'
import { publishRedactedPages } from './publish-redacted-pages.ts'
import type { ReviewAction, reviewRefusalSchema } from './review-action.ts'

type DocumentRow = typeof documents.$inferSelect

type RedactionRow = typeof redactions.$inferSelect

type ObservationRow = typeof observations.$inferSelect

/** Persisted review state needed to validate and apply one action. */
export type ReviewState = Pick<
  DocumentRow,
  | 'status'
  | 'patientId'
  | 'identityMismatch'
  | 'identifierHashes'
  | 'proposedPatient'
> & {
  pageCount: number
  redactions: Pick<RedactionRow, 'id' | 'page' | 'points' | 'state'>[]
  observations: Pick<
    ObservationRow,
    'id' | 'reviewStatus' | 'removedByRedactionIds'
  >[]
}

/** Why an action cannot apply to the document's current state; the channel answers 409. */
export type ReviewRefusal = z.infer<typeof reviewRefusalSchema>

/** Row changes committed atomically with one review event. */
export type ReviewWrite = {
  event: {
    action: (typeof reviewEvents.$inferInsert)['action']
    payload: Record<string, string>
  }
  document?: Partial<
    Pick<
      DocumentRow,
      'patientId' | 'identityMismatch' | 'status' | 'reviewedAt'
    >
  >
  patient?: typeof patients.$inferInsert
  redaction?: Pick<RedactionRow, 'id' | 'state'>
  observation?: Pick<ObservationRow, 'id' | 'reviewStatus'>
  restoreRedactionId?: string
}

type Plan = { refusal: ReviewRefusal } | { write: ReviewWrite | null }

type Dependencies = {
  load: (documentId: string) => Promise<ReviewState | undefined>
  patientExists: (patientId: string) => Promise<boolean>
  write: (documentId: string, write: ReviewWrite) => Promise<void>
  storage: Pick<typeof storage, 'get' | 'put'>
  key: () => Buffer
  burn: (
    image: Uint8Array,
    regions: Pick<RedactionRow, 'points'>[]
  ) => Promise<Buffer>
  publish: (documentId: string, pages: Buffer[]) => Promise<number>
}

const proposedPatientSchema = z.strictObject({
  initials: z.string().min(1).max(8),
  birthYear: z.number().int().min(1900).max(2100).nullable(),
  sex: z.enum(['Female', 'Male', 'Unknown']),
})

const defaults: Dependencies = {
  load: loadReviewState,
  patientExists: async (patientId) =>
    (
      await createDb()
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1)
    ).length === 1,
  write: writeReview,
  storage,
  key: () => encryptionKey(process.env.DOCUMENT_ENCRYPTION_KEY),
  burn: async (image, regions) =>
    (await import('#stages/redact/burn-redactions')).burnRedactions(
      image,
      regions
    ),
  publish: publishRedactedPages,
}

/** Review sources are unredacted page PNGs, so they live only under this encrypted prefix. */
export function reviewSourcePrefix(documentId: string) {
  return `documents/${documentId}/redaction/source/`
}

/** Checks an action against persisted state without writing, so the channel can refuse it before resuming the hook. */
export async function checkReviewAction(
  documentId: string,
  action: ReviewAction,
  overrides: Partial<Dependencies> = {}
): Promise<ReviewRefusal | null> {
  const deps = { ...defaults, ...overrides }
  const state = await deps.load(documentId)
  if (!state) return 'targetNotFound'

  const plan = await planAction(documentId, state, action, deps)
  return 'refusal' in plan ? plan.refusal : null
}

/** Applies one review action; repeating an applied action is a no-op, so retried steps never duplicate events. */
export async function applyReviewAction(
  documentId: string,
  action: ReviewAction,
  overrides: Partial<Dependencies> = {}
): Promise<{ applied: boolean } | { refusal: ReviewRefusal }> {
  const deps = { ...defaults, ...overrides }
  const state = await deps.load(documentId)
  if (!state) return { refusal: 'targetNotFound' }

  const plan = await planAction(documentId, state, action, deps)
  if ('refusal' in plan) return plan

  // Publish before recording the decision so a retry still sees the old state and re-burns.
  if (plan.write?.redaction)
    await reburnPages(documentId, state, plan.write.redaction, deps)
  if (plan.write) await deps.write(documentId, plan.write)

  return { applied: plan.write !== null }
}

async function planAction(
  documentId: string,
  state: ReviewState,
  action: ReviewAction,
  deps: Pick<Dependencies, 'patientExists'>
): Promise<Plan> {
  const terminal = action.type === 'markReviewed' || action.type === 'discard'
  if (
    terminal &&
    state.status === (action.type === 'discard' ? 'discarded' : 'reviewed')
  )
    return { write: null }
  if (
    state.status !== 'needsReview' &&
    !(action.type === 'discard' && state.status === 'unsupported')
  )
    return { refusal: 'notReviewable' }

  const unchanged = { write: null }
  switch (action.type) {
    case 'redaction.update': {
      const redaction = state.redactions.find(
        ({ id }) => id === action.redactionId
      )
      if (!redaction) return { refusal: 'targetNotFound' }
      if (redaction.state === action.status) return unchanged
      // Unredacted content may already be published, so a rejection is final.
      if (redaction.state === 'rejected')
        return { refusal: 'redactionRejected' }

      const rejected = action.status === 'rejected'
      return {
        write: {
          event: {
            action: action.type,
            payload: { redactionId: redaction.id, status: action.status },
          },
          redaction: { id: redaction.id, state: action.status },
          ...(rejected ? { restoreRedactionId: redaction.id } : {}),
        },
      }
    }
    case 'observation.update': {
      const observation = state.observations.find(
        ({ id }) => id === action.observationId
      )
      if (!observation) return { refusal: 'targetNotFound' }
      if (observation.removedByRedactionIds.length)
        return { refusal: 'observationRemoved' }

      const reviewStatus =
        action.status === 'accepted' ? 'confirmed' : 'rejected'
      if (observation.reviewStatus === reviewStatus) return unchanged

      return {
        write: {
          event: {
            action: action.type,
            payload: { observationId: observation.id, status: action.status },
          },
          observation: { id: observation.id, reviewStatus },
        },
      }
    }
    case 'patient.link': {
      if (state.patientId === action.patientId && !state.identityMismatch)
        return unchanged
      if (!(await deps.patientExists(action.patientId)))
        return { refusal: 'patientNotFound' }

      return {
        write: {
          event: {
            action: action.type,
            payload: { patientId: action.patientId },
          },
          document: { patientId: action.patientId, identityMismatch: false },
        },
      }
    }
    case 'patient.create': {
      const patientId = createdPatientId(documentId)
      if (state.patientId === patientId && !state.identityMismatch)
        return unchanged

      const proposed = proposedPatientSchema.safeParse(state.proposedPatient)
      if (!proposed.success) return { refusal: 'noProposedPatient' }

      const hashes = state.identifierHashes ?? {}
      return {
        write: {
          event: { action: action.type, payload: { patientId } },
          patient: {
            id: patientId,
            mrnHash: hashes.mrn ?? null,
            firstNameHash: hashes.firstName ?? null,
            lastNameHash: hashes.lastName ?? null,
            birthDateHash: hashes.birthDate ?? null,
            ...proposed.data,
          },
          document: { patientId, identityMismatch: false },
        },
      }
    }
    case 'markReviewed': {
      const blocked =
        !state.patientId ||
        state.identityMismatch ||
        state.redactions.some(({ state }) => state === 'needsReview') ||
        state.observations.some(
          (observation) =>
            observation.reviewStatus === 'flagged' &&
            !observation.removedByRedactionIds.length
        )
      if (blocked) return { refusal: 'reviewIncomplete' }

      return {
        write: {
          event: { action: action.type, payload: {} },
          document: { status: 'reviewed', reviewedAt: new Date() },
        },
      }
    }
    case 'discard':
      return {
        write: {
          event: { action: action.type, payload: {} },
          document: { status: 'discarded' },
        },
      }
  }
}

function createdPatientId(documentId: string) {
  // Derived from the document so a retried creation finds the same patient.
  const digest = createHash('sha256')
    .update(`patient:${documentId}`)
    .digest('hex')

  return `PT-${digest.slice(0, 10).toUpperCase()}`
}

async function reburnPages(
  documentId: string,
  state: ReviewState,
  change: Pick<RedactionRow, 'id' | 'state'>,
  deps: Dependencies
) {
  const key = deps.key()
  const kept = state.redactions
    .map((redaction) =>
      redaction.id === change.id ? { ...redaction, ...change } : redaction
    )
    .filter(({ state }) => state === 'applied' || state === 'accepted')
  const pages: Buffer[] = []
  for (let page = 1; page <= state.pageCount; page++) {
    const source = await readEncrypted(
      `${reviewSourcePrefix(documentId)}${page}.png.enc`,
      deps,
      key
    )
    pages.push(
      await deps.burn(
        source,
        kept.filter((redaction) => redaction.page === page)
      )
    )
  }

  await deps.publish(documentId, pages)
}

async function loadReviewState(
  documentId: string
): Promise<ReviewState | undefined> {
  const db = createDb()
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)
  if (!document) return undefined

  const [redactionRows, observationRows] = await Promise.all([
    db
      .select({
        id: redactions.id,
        page: redactions.page,
        points: redactions.points,
        state: redactions.state,
      })
      .from(redactions)
      .where(eq(redactions.documentId, documentId)),
    db
      .select({
        id: observations.id,
        reviewStatus: observations.reviewStatus,
        removedByRedactionIds: observations.removedByRedactionIds,
      })
      .from(observations)
      .where(eq(observations.documentId, documentId)),
  ])

  return {
    ...document,
    pageCount: document.pageDimensions.length,
    redactions: redactionRows,
    observations: observationRows,
  }
}

async function writeReview(documentId: string, change: ReviewWrite) {
  const db = createDb()
  const queries = []
  if (change.patient)
    queries.push(
      db.insert(patients).values(change.patient).onConflictDoNothing()
    )
  if (change.document)
    queries.push(
      db
        .update(documents)
        .set(change.document)
        .where(eq(documents.id, documentId))
    )
  if (change.redaction)
    queries.push(
      db
        .update(redactions)
        .set({ state: change.redaction.state })
        .where(
          and(
            eq(redactions.id, change.redaction.id),
            eq(redactions.documentId, documentId)
          )
        )
    )
  if (change.observation)
    queries.push(
      db
        .update(observations)
        .set({ reviewStatus: change.observation.reviewStatus })
        .where(
          and(
            eq(observations.id, change.observation.id),
            eq(observations.documentId, documentId)
          )
        )
    )
  if (change.restoreRedactionId) {
    queries.push(
      db
        .update(noteChunks)
        .set({
          removedByRedactionIds: sql`array_remove(${noteChunks.removedByRedactionIds}, ${change.restoreRedactionId})`,
        })
        .where(eq(noteChunks.documentId, documentId))
    )
    queries.push(
      db
        .update(observations)
        .set({
          removedByRedactionIds: sql`array_remove(${observations.removedByRedactionIds}, ${change.restoreRedactionId})`,
        })
        .where(eq(observations.documentId, documentId))
    )
  }

  // Neon HTTP batches run in one transaction, so the event and its row changes commit together.
  await db.batch([
    db.insert(reviewEvents).values({
      id: randomUUID(),
      documentId,
      action: change.event.action,
      payload: change.event.payload,
    }),
    ...queries,
  ])
}
