import { z } from 'zod'

/** Validates document IDs before filesystem or workflow access. */
export const documentIdSchema = z.uuid()

/** Accepts review decisions without document content. */
export const reviewActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('markReviewed') }),
  z.strictObject({ type: z.literal('discard') }),
  z.strictObject({
    type: z.literal('redaction.update'),
    redactionId: z.uuid(),
    status: z.enum(['accepted', 'rejected']),
  }),
])

/** Validated review decision accepted by the document hook. */
export type ReviewAction = z.infer<typeof reviewActionSchema>

/** Identifies the document review hook consistently across requests and replays. */
export function reviewToken(documentId: string): string {
  // Routes must locate the same hook after a restart without storing its token.
  return `document:${documentId}:review`
}

/** Restricts ingestion to the supported synthetic fixture. */
export const startDocumentSchema = z.strictObject({
  fixtureId: z.literal('clinical-20').default('clinical-20'),
})

/** Validates document and workflow identifiers returned at startup. */
export const startResultSchema = z.strictObject({
  documentId: documentIdSchema,
  runId: z.string().min(1),
})

/** Validates workflow status and optional terminal review metadata. */
export const documentStatusSchema = startResultSchema.extend({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  result: z
    .strictObject({
      documentId: documentIdSchema,
      status: z.enum(['reviewed', 'discarded']),
      refreshCount: z.number().int().nonnegative(),
    })
    .optional(),
})

/** Validates acknowledgment of an accepted review action. */
export const reviewResultSchema = z.strictObject({ accepted: z.literal(true) })
