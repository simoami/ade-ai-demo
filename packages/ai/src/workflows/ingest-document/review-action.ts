import { z } from 'zod'

export const documentIdSchema = z.uuid()

export const reviewActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('markReviewed') }),
  z.strictObject({ type: z.literal('discard') }),
  z.strictObject({
    type: z.literal('redaction.update'),
    redactionId: z.uuid(),
    status: z.enum(['accepted', 'rejected']),
  }),
])

export type ReviewAction = z.infer<typeof reviewActionSchema>

export function reviewToken(documentId: string): string {
  return `document:${documentId}:review`
}

export const startDocumentSchema = z.strictObject({
  fixtureId: z.literal('clinical-20').default('clinical-20'),
})

export const startResultSchema = z.strictObject({
  documentId: documentIdSchema,
  runId: z.string().min(1),
})

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

export const reviewResultSchema = z.strictObject({ accepted: z.literal(true) })
