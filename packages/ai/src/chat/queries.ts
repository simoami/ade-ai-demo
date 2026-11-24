import { and, asc, documents, eq, ne, observations, sql } from '@repo/db'
import type { z } from 'zod'
import type { observationQuerySchema } from './context.ts'

/** Most dated points one trend reads; the prompt and tool description state the same bound. */
export const TREND_POINT_LIMIT = 100

/** Most documents one listing returns, newest first. */
export const DOCUMENT_LIST_LIMIT = 50

/** SQL predicates always hide rejected and redaction-removed clinical facts. */
export function observationFilters(
  input: z.infer<typeof observationQuerySchema>
) {
  return and(
    ne(observations.reviewStatus, 'rejected'),
    sql`cardinality(${observations.removedByRedactionIds}) = 0`,
    input.documentId
      ? eq(observations.documentId, input.documentId)
      : undefined,
    input.patientId ? eq(documents.patientId, input.patientId) : undefined,
    input.kind ? eq(observations.kind, input.kind) : undefined,
    input.name
      ? sql`strpos(lower(${observations.name}), lower(${input.name})) > 0`
      : undefined,
    input.outOfRangeOnly
      ? sql`${observations.kind} = 'lab' and ${observations.details}->>'flagNormalized' in ('low', 'high', 'abnormal')`
      : undefined
  )
}

/** Code or exact printed-name dated rows for one patient; undated rows never reach the limit, so they cannot crowd out plottable points. */
export function trendFilters(patientId: string, name: string, code?: string) {
  return and(
    observationFilters({ patientId }),
    code
      ? sql`${observations.details}->>'code' = ${code}`
      : eq(observations.name, name),
    sql`${observations.effectiveDate} is not null`
  )
}

/** Newest first with stable ties. Postgres sorts NULLs first in descending order, so undated rows are pushed last explicitly. */
export const newestFirst = [
  sql`${observations.effectiveDate} desc nulls last`,
  asc(observations.id),
]
