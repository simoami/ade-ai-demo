import { and, asc, documents, eq, observations, sql } from '@repo/db'
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

/** Exact-name, dated rows for one patient; undated rows never reach the limit, so they cannot crowd out plottable points. */
export function trendFilters(patientId: string, name: string) {
  return and(
    observationFilters({ patientId }),
    sql`lower(${observations.name}) = lower(${name})`,
    sql`${observations.effectiveDate} is not null`
  )
}

/** Newest first with stable ties. Postgres sorts NULLs first in descending order, so undated rows are pushed last explicitly. */
export const newestFirst = [
  sql`${observations.effectiveDate} desc nulls last`,
  asc(observations.id),
]
