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
import { documentScopedId } from './deterministic-id.ts'
import {
  artifactDefaults,
  readIdentifierSpans,
  readOcr,
} from './document-artifacts.ts'
import { listRedactions, replaceNoteChunks } from './document-store.ts'

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

// A character ceiling keeps even a dense OCR block within the embedding model's token limit.
const maxChunkLength = 2000

/** Groups each heading with the blocks under it so a section is retrieved with its title; blocks before any heading stay separate. */
function noteSections(blocks: Block[], page: number) {
  const sections: { text: string; source: Chunk['source'] }[] = []
  let heading: string | null = null
  for (const block of blocks) {
    const text = block.text.trim()
    const source = { page, blockId: block.id, box: block.box }
    const current = sections.at(-1)
    if (block.kind === 'heading') {
      heading = text
      sections.push({ text, source: [source] })
    } else if (
      heading !== null &&
      current &&
      current.text.length + text.length < maxChunkLength
    ) {
      current.text += `\n${text}`
      current.source.push(source)
    } else {
      sections.push({
        text: heading === null ? text : `${heading}\n${text}`,
        source: [source],
      })
    }
  }
  return sections
}

/** Builds bounded section chunks from identifier-masked blocks; embeddings and text never enter workflow history. */
export async function buildNoteChunks(
  documentId: string,
  pages: OcrPage[],
  spans: MaskedSpans,
  embedder: Embedder = embed
): Promise<Chunk[]> {
  const chunks = maskIdentifiers(pages, spans).flatMap((page, pageIndex) => {
    let index = 0
    const blocks = page.blocks.filter(isSearchableNoteBlock)
    return noteSections(blocks, pageIndex + 1).flatMap(({ text, source }) =>
      Array.from(
        { length: Math.ceil(text.length / maxChunkLength) },
        (_, part) => ({
          id: documentScopedId(documentId, `note:${pageIndex + 1}:${index++}`),
          documentId,
          text: text.slice(part * maxChunkLength, (part + 1) * maxChunkLength),
          source,
        })
      ).filter((chunk) =>
        /[\p{L}\p{N}]/u.test(chunk.text.replaceAll(identifierPlaceholder, ''))
      )
    )
  })
  if (!chunks.length) return []

  try {
    const embeddings = embeddingsSchema.safeParse(
      await embedder(chunks.map(({ text }) => text))
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
