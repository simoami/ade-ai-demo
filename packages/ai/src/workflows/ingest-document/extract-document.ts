import type { Box, observations } from '@repo/db'
import type { ExtractedObservation } from '#stages/extract/extract-observations'
import type { MaskedSpans } from '#stages/extract/mask-identifiers'
import { observationBox } from '#stages/extract/observation-box'
import type { OcrPage } from '#stages/ocr/ocr-result'
import { documentScopedId } from './deterministic-id.ts'
import {
  type ArtifactDependencies,
  artifactDefaults,
  readIdentifierSpans,
  readOcr,
} from './document-artifacts.ts'
import {
  listRedactions,
  replaceObservations,
  updateDocument,
} from './document-store.ts'

type Dependencies = ArtifactDependencies & {
  update: typeof updateDocument
  extract: (
    pages: OcrPage[],
    masked: MaskedSpans
  ) => Promise<ExtractedObservation[]>
  redactions: typeof listRedactions
  replace: typeof replaceObservations
}

const defaults: Dependencies = {
  ...artifactDefaults,
  update: updateDocument,
  extract: async (pages, masked) =>
    (await import('#stages/extract/extract-observations')).extractObservations(
      pages,
      masked
    ),
  redactions: listRedactions,
  replace: replaceObservations,
}

/** Observations below this confidence need a reviewer. */
const flagBelow = 0.7

/** Coverage of an observation's box at which a redaction removes it (docs/architecture.md, Review). */
const removeAtCoverage = 0.3

function coverage(item: Box, redaction: Box) {
  const width =
    Math.min(item.x + item.width, redaction.x + redaction.width) -
    Math.max(item.x, redaction.x)
  const height =
    Math.min(item.y + item.height, redaction.y + redaction.height) -
    Math.max(item.y, redaction.y)
  const area = item.width * item.height

  return width > 0 && height > 0 && area > 0 ? (width * height) / area : 0
}

/** Extracts observations from identifier-masked OCR, records covering redactions and replaces rows with deterministic IDs. */
export async function extractDocumentObservations(
  documentId: string,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    await deps.update(documentId, { status: 'extracting' })
    const pages = await readOcr(documentId, deps)
    const extracted = await deps.extract(
      pages,
      await readIdentifierSpans(documentId, deps)
    )
    const redactions = (await deps.redactions(documentId)).filter(
      (redaction) => redaction.state !== 'rejected'
    )

    const rows = new Map<string, typeof observations.$inferInsert>()
    for (const observation of extracted) {
      const block = pages[observation.page - 1]?.blocks.find(
        (block) => block.id === observation.blockId
      )
      if (!block) throw new Error('Observation cites an unknown block')

      const id = documentScopedId(
        documentId,
        `observation:${observation.page}:${observation.blockId}:${observation.name}:${observation.effectiveDate ?? ''}`
      )
      // Undated restatements in one block share an ID; the first is kept.
      if (rows.has(id)) continue

      const box = observationBox(
        block,
        pages[observation.page - 1]?.words,
        observation
      )

      rows.set(id, {
        id,
        documentId,
        kind: observation.kind,
        name: observation.name,
        value: observation.value,
        valueNumeric:
          observation.valueNumeric === null
            ? null
            : String(observation.valueNumeric),
        unit: observation.unit,
        effectiveDate: observation.effectiveDate,
        dateSource: observation.dateSource,
        sourceFormat: observation.sourceFormat,
        source: [{ page: observation.page, blockId: block.id, box }],
        reviewStatus:
          observation.confidence < flagBelow ? 'flagged' : 'unchecked',
        details: observation.details,
        removedByRedactionIds: redactions
          .filter(
            (redaction) =>
              redaction.page === observation.page &&
              coverage(box, redaction.box) >= removeAtCoverage
          )
          .map((redaction) => redaction.id),
      })
    }

    const values = [...rows.values()]
    await deps.replace(documentId, values)
    await deps.update(documentId, { status: 'needsReview' })

    return {
      observationCount: values.length,
      flaggedCount: values.filter((row) => row.reviewStatus === 'flagged')
        .length,
      removedCount: values.filter((row) => row.removedByRedactionIds?.length)
        .length,
    }
  } catch {
    throw new Error('Document extraction failed')
  }
}

/** Ends processing by class: clinical documents are extracted, consent opens review, other is unsupported; returns counts only. */
export async function finishProcessing(
  documentId: string,
  documentClass: 'clinical' | 'consent' | 'other',
  overrides: Partial<Dependencies> = {}
) {
  if (documentClass === 'clinical')
    return {
      status: 'needsReview' as const,
      ...(await extractDocumentObservations(documentId, overrides)),
    }

  const status = documentClass === 'consent' ? 'needsReview' : 'unsupported'
  await (overrides.update ?? defaults.update)(documentId, { status })
  return { status, observationCount: 0, flaggedCount: 0, removedCount: 0 }
}
