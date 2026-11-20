import { z } from 'zod'

/** Validates document IDs before database or workflow access. */
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

/** Accepts only relative original-upload Blob paths without traversal or URL syntax. */
export const uploadPathname = z
  .string()
  .min(9)
  .max(1024)
  .refine(
    (value) =>
      value.startsWith('uploads/') &&
      !/[\\?#%]/.test(value) &&
      [...value].every(
        (character) =>
          character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127
      ) &&
      value
        .split('/')
        .every((part) => part !== '' && part !== '.' && part !== '..'),
    'Invalid upload pathname'
  )

/** Validates one PDF or ordered image upload references; content types are checked when rendered. */
export const startDocumentSchema = z.strictObject({
  fileName: z.string().min(1).max(255),
  pathnames: z.array(uploadPathname).min(1).max(30),
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
