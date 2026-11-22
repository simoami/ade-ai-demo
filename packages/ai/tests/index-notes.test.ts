import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { noteChunks } from '@repo/db'
import type { OcrPage } from '#stages/ocr/ocr-result'
import {
  buildNoteChunks,
  indexDocumentNotes,
} from '#workflows/ingest-document/index-notes'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

const box = { x: 0.1, y: 0.1, width: 0.5, height: 0.1 }

const pages: OcrPage[] = [
  {
    blocks: [
      {
        id: 'note',
        kind: 'paragraph',
        text: 'Synthetic Person: assessment stable',
        box,
        continues: null,
      },
      {
        id: 'figure',
        kind: 'figure',
        text: 'Synthetic face',
        box,
        continues: null,
      },
    ],
    usage: { latencyMs: 0 },
  },
]

const spans = [{ page: 1, blockId: 'note', start: 0, end: 16 }]

const embed = async (values: string[]) =>
  values.map(() => Array<number>(1536).fill(0.1))

test('embeds only masked text and keeps stable IDs and block source geometry', async () => {
  const chunks = await buildNoteChunks(
    documentId,
    pages,
    spans,
    async (values) => {
      assert.deepEqual(values, ['[REDACTED]: assessment stable'])
      return embed(values)
    }
  )
  assert.deepEqual(
    chunks,
    await buildNoteChunks(documentId, pages, spans, embed)
  )
  assert.deepEqual(chunks[0]?.source, [{ page: 1, blockId: 'note', box }])
  assert.notEqual(
    chunks[0]?.id,
    (
      await buildNoteChunks(
        'c75ca547-5179-449d-b243-4958f4ef674d',
        pages,
        spans,
        embed
      )
    )[0]?.id
  )
})

test('bounds large blocks, keeps unique IDs and skips blank text without calling the embedder', async () => {
  const long = [
    {
      ...pages[0],
      blocks: [
        {
          id: 'long',
          kind: 'paragraph' as const,
          text: 'a'.repeat(4100),
          box,
          continues: null,
        },
      ],
      usage: { latencyMs: 0 },
    },
  ]
  const chunks = await buildNoteChunks(documentId, long, [], embed)
  assert.deepEqual(
    chunks.map(({ text }) => text.length),
    [2000, 2000, 100]
  )
  assert.equal(new Set(chunks.map(({ id }) => id)).size, 3)
  assert.deepEqual(
    await buildNoteChunks(documentId, [], [], async () => {
      throw new Error('must not call')
    }),
    []
  )
})

test('rejects invalid embedding count, dimensions and provider errors without exposing text', async () => {
  for (const embedder of [
    async () => [],
    async () => [[1]],
    async () => {
      throw new Error('Synthetic Person')
    },
  ])
    await assert.rejects(buildNoteChunks(documentId, pages, spans, embedder), {
      message: 'Note embedding failed',
    })
})

test('replaces the index only after successful embedding and records covering non-identifier redactions', async () => {
  let rows: (typeof noteChunks.$inferInsert)[] = []
  let writes = 0
  const deps = {
    readOcr: async () => pages,
    readIdentifierSpans: async () =>
      spans.map((span) => ({
        ...span,
        category: 'name' as const,
        confidence: 1,
      })),
    embed,
    replace: async (
      _id: string,
      chunks: (typeof noteChunks.$inferInsert)[]
    ) => {
      rows = chunks
      writes++
    },
    redactions: async () => [
      {
        id: 'identifier',
        page: 1,
        box,
        category: 'name',
        state: 'applied' as const,
      },
      { id: 'face', page: 1, box, category: 'face', state: 'applied' as const },
      {
        id: 'rejected',
        page: 1,
        box,
        category: 'face',
        state: 'rejected' as const,
      },
    ],
  }
  assert.deepEqual(await indexDocumentNotes(documentId, deps), {
    chunkCount: 1,
  })
  assert.deepEqual(rows[0]?.removedByRedactionIds, ['face'])
  await assert.rejects(
    indexDocumentNotes(documentId, {
      ...deps,
      embed: async () => {
        throw new Error('Synthetic private text')
      },
    }),
    { message: 'Note indexing failed' }
  )
  assert.equal(writes, 1)
})
