import type { noteChunks } from '@repo/db'
import { embedMany } from 'ai'
import { z } from 'zod'
import { embeddingModel } from '#models'
import {
  identifierPlaceholder,
  type MaskedSpans,
  maskIdentifiers,
} from '#stages/extract/mask-identifiers'
import type { Block, OcrPage } from '#stages/ocr/ocr-result'
import { documentScopedId } from '#workflows/ingest-document/deterministic-id'
import {
  artifactDefaults,
  readIdentifierSpans,
  readOcr,
} from '#workflows/ingest-document/document-artifacts'
import {
  listRedactions,
  replaceNoteChunks,
} from '#workflows/ingest-document/document-store'

type Embedder = (values: string[]) => Promise<number[][]>

type Chunk = typeof noteChunks.$inferInsert

const embeddingsSchema = z.array(z.array(z.number().finite()).length(1536))

async function embed(values: string[]) {
  const result = await embedMany({
    model: embeddingModel,
    values,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(180_000),
  })
  return result.embeddings
}

/** Exclude page furniture and masked blocks without searchable content. */
export function isSearchableNoteBlock(block: Block): boolean {
  return (
    block.kind !== 'header' &&
    block.kind !== 'footer' &&
    !/^(?:page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(block.text.trim()) &&
    /[\p{L}\p{N}]/u.test(block.text.replaceAll(identifierPlaceholder, ''))
  )
}

const maxChunkLength = 2000

// Keep common clinical abbreviations and initials intact; decimal points have no following whitespace.
function sentences(text: string) {
  return text.split(
    /(?<!\b(?:dr|mr|mrs|ms|mg|vs|etc|e\.g|i\.e|b\.i\.d)\.)(?<!\b[a-z]\.)(?<=[.!?])\s+/i
  )
}

type NotePiece = { text: string; source: Chunk['source']; table?: boolean }

function splitSection(blocks: NotePiece[]): NotePiece[] {
  const pieces: NotePiece[] = []
  let current: NotePiece = { text: '', source: [] }
  let hasBody = false
  let overlap: NotePiece = current

  const flush = () => {
    pieces.push(current)
    current = { ...overlap }
    hasBody = false
  }

  for (const block of blocks) {
    if (hasBody && current.text.length + block.text.length + 1 > maxChunkLength)
      flush()

    const parts =
      !block.table &&
      current.text.length + block.text.length + 1 > maxChunkLength
        ? sentences(block.text)
        : [block.text]
    for (const text of parts) {
      if (hasBody && current.text.length + text.length + 1 > maxChunkLength)
        flush()

      current.text = [current.text, text].filter(Boolean).join('\n')
      current.source = [
        ...new Map(
          [...current.source, ...block.source].map((source) => [
            source.blockId,
            source,
          ])
        ).values(),
      ]
      overlap = { text: sentences(text).at(-1) ?? text, source: block.source }
      hasBody = true
    }
  }
  if (current.text) pieces.push(current)

  return pieces
}

/** Builds embedding input from the section path and body without changing stored text. */
export function noteEmbeddingInput({
  section,
  text,
}: {
  section?: string | null
  text: string
}): string {
  return section ? `[${section}]\n${text}` : text
}

/** Builds page-bounded section chunks from identifier-masked blocks; embeddings and text never enter workflow history. */
export async function buildNoteChunks(
  documentId: string,
  pages: OcrPage[],
  spans: MaskedSpans,
  embedder: Embedder = embed
): Promise<Chunk[]> {
  const headings: string[] = []
  const chunks = maskIdentifiers(pages, spans).flatMap((page, pageIndex) => {
    const sections: { section: string | null; blocks: NotePiece[] }[] = []
    let current: (typeof sections)[number] | undefined
    for (const block of page.blocks.filter(isSearchableNoteBlock)) {
      if (block.kind === 'heading') {
        const level = block.level ?? 2
        headings.length = level - 1
        headings[level - 1] = block.text.trim()
        current = undefined
        continue
      }

      const section = headings.filter(Boolean).join(' › ') || null
      if (!current || !section) {
        current = { section, blocks: [] }
        sections.push(current)
      }
      current.blocks.push({
        text: block.text.trim(),
        table: block.kind === 'table',
        source: [{ page: pageIndex + 1, blockId: block.id, box: block.box }],
      })
    }

    let index = 0
    return sections.flatMap(({ section, blocks }) =>
      splitSection(blocks).map(({ text, source }) => ({
        id: documentScopedId(documentId, `note:${pageIndex + 1}:${index++}`),
        documentId,
        section,
        text,
        source,
      }))
    )
  })
  if (!chunks.length) return []

  try {
    const embeddings = embeddingsSchema.safeParse(
      await embedder(chunks.map(noteEmbeddingInput))
    )
    if (!embeddings.success || embeddings.data.length !== chunks.length)
      throw new Error('Invalid note embeddings')

    return chunks.map((chunk, index) => {
      const embedding = embeddings.data[index]
      if (!embedding) throw new Error('Missing note embedding')

      return { ...chunk, embedding }
    })
  } catch {
    throw new Error('Note embedding failed')
  }
}

const defaults = {
  ...artifactDefaults,
  readOcr,
  readIdentifierSpans,
  embed,
  replace: replaceNoteChunks,
  redactions: listRedactions,
}

/** Atomically replaces one document's masked search index; returns counts only. */
export async function indexDocumentNotes(
  documentId: string,
  overrides: Partial<typeof defaults> = {}
) {
  const deps = { ...defaults, ...overrides }
  try {
    const chunks = await buildNoteChunks(
      documentId,
      await deps.readOcr(documentId, deps),
      await deps.readIdentifierSpans(documentId, deps),
      deps.embed
    )
    // Text identifier regions are already masked; suppressing their whole block would hide surrounding clinical notes.
    const identifierCategories = new Set([
      'name',
      'dob',
      'id',
      'address',
      'phone',
      'email',
      'ssn',
      'facility',
      'provider',
    ])
    const redactions = (await deps.redactions(documentId)).filter(
      ({ state, category }) =>
        state !== 'rejected' && !identifierCategories.has(category)
    )
    for (const chunk of chunks) {
      chunk.removedByRedactionIds = redactions
        .filter((redaction) =>
          chunk.source.some(
            ({ page, box }) =>
              page === redaction.page &&
              box.x < redaction.box.x + redaction.box.width &&
              box.x + box.width > redaction.box.x &&
              box.y < redaction.box.y + redaction.box.height &&
              box.y + box.height > redaction.box.y
          )
        )
        .map(({ id }) => id)
    }
    await deps.replace(documentId, chunks)

    return { chunkCount: chunks.length }
  } catch {
    throw new Error('Note indexing failed')
  }
}
