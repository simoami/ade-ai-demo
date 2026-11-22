import { and, documents, eq, observations, sql } from '@repo/db'
import type { z } from 'zod'
import type { observationQuerySchema } from './context.ts'

/** SQL predicates always hide rejected and redaction-removed clinical facts. */
export function observationFilters(
  input: z.infer<typeof observationQuerySchema>
) {
  return and(
    sql`${observations.reviewStatus} <> 'rejected'`,
    sql`cardinality(${observations.removedByRedactionIds}) = 0`,
    input.documentId
      ? eq(observations.documentId, input.documentId)
      : undefined,
    input.patientId ? eq(documents.patientId, input.patientId) : undefined,
    input.kind ? sql`${observations.kind} = ${input.kind}` : undefined,
    input.name
      ? sql`strpos(lower(${observations.name}), lower(${input.name})) > 0`
      : undefined,
    input.outOfRangeOnly
      ? sql`${observations.kind} = 'lab' and ${observations.details}->>'flagNormalized' in ('low', 'high', 'abnormal')`
      : undefined
  )
}
