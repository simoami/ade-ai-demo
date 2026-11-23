import type { noteChunks } from '@repo/db'
import { embedMany } from 'ai'
import { z } from 'zod'
import { embeddingModel } from '#models'
import {
  IDENTIFIER_PLACEHOLDER,
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

// About 500 tokens: large enough for a typical note section, well within the embedding model's input limit.
const MAX_CHUNK_LENGTH = 2000

/**
 * Splits text after `.`, `!` or `?` followed by whitespace, without breaking common clinical abbreviations.
 * "Seen by Dr. Lee. Metformin 500 mg b.i.d. continued." → ["Seen by Dr. Lee.", "Metformin 500 mg b.i.d. continued."]
 * Decimals such as "HbA1c 7.8" never split because no whitespace follows their period.
 */
function sentences(text: string) {
  return text.split(
    /(?<!\b(?:dr|mr|mrs|ms|mg|vs|etc|e\.g|i\.e|q\.d|b\.i\.d|t\.i\.d)\.)(?<!\b[a-z]\.)(?<=[.!?])\s+/i
  )
}

/** Text with the OCR regions it came from, so every chunk can cite boxes on the page. */
type NotePiece = { text: string; source: Chunk['source']; table?: boolean }

/**
 * Packs one note section's blocks into chunks of at most `maxChunkLength` characters.
 * Blocks arrive in reading order from a single section on a single page, so every chunk shares one section path and one page.
 * A block that does not fit is split into sentences; tables are kept whole because their rows only make sense together.
 */
function splitSection(blocks: NotePiece[]): NotePiece[] {
  const pieces: NotePiece[] = []
  let current: NotePiece = { text: '', source: [] }
  // False while `current` holds only the carried-over sentence, so a chunk is never closed before it has new text.
  let hasBody = false
  // The last sentence added; it opens the next chunk so a thought cut at the boundary is still readable on both sides.
  let overlap: NotePiece = current

  // Closes the current chunk and starts the next one with the overlap sentence.
  const flush = () => {
    pieces.push(current)
    current = { ...overlap }
    hasBody = false
  }

  for (const block of blocks) {
    // The + 1 accounts for the newline that joins block texts.
    if (
      hasBody &&
      current.text.length + block.text.length + 1 > MAX_CHUNK_LENGTH
    )
      flush()

    const parts =
      !block.table &&
      current.text.length + block.text.length + 1 > MAX_CHUNK_LENGTH
        ? sentences(block.text)
        : [block.text]
    for (const text of parts) {
      if (hasBody && current.text.length + text.length + 1 > MAX_CHUNK_LENGTH)
        flush()

      current.text = [current.text, text].filter(Boolean).join('\n')
      // A block split into sentences contributes its source region once per chunk.
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

/** Exclude page furniture and masked blocks without searchable content. */
export function isSearchableNoteBlock(block: Block): boolean {
  return (
    block.kind !== 'header' &&
    block.kind !== 'footer' &&
    !/^(?:page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(block.text.trim()) &&
    /[\p{L}\p{N}]/u.test(block.text.replaceAll(IDENTIFIER_PLACEHOLDER, ''))
  )
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
