import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { noteChunks } from '@repo/db'
import { blockSchema, type OcrPage } from '#stages/ocr/ocr-result'
import {
  buildNoteChunks,
  indexDocumentNotes,
  isSearchableNoteBlock,
  noteEmbeddingInput,
} from '#workflows/ingest-document/index-notes'

const DOCUMENT_ID = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

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
    DOCUMENT_ID,
    pages,
    spans,
    async (values) => {
      assert.deepEqual(values, ['[REDACTED]: assessment stable'])
      return embed(values)
    }
  )
  assert.deepEqual(
    chunks,
    await buildNoteChunks(DOCUMENT_ID, pages, spans, embed)
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

test('preserves indivisible oversized sentences, keeps unique IDs and skips blank text without calling the embedder', async () => {
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
  const chunks = await buildNoteChunks(DOCUMENT_ID, long, [], embed)
  assert.deepEqual(
    chunks.map(({ text }) => text.length),
    [4100]
  )
  assert.equal(new Set(chunks.map(({ id }) => id)).size, 1)
  assert.deepEqual(
    await buildNoteChunks(DOCUMENT_ID, [], [], async () => {
      throw new Error('must not call')
    }),
    []
  )
})

test('stores section headings separately and keeps earlier blocks separate', async () => {
  const block = (id: string, kind: 'heading' | 'paragraph', text: string) => ({
    id,
    kind,
    text,
    box,
    continues: null,
  })
  const chunks = await buildNoteChunks(
    DOCUMENT_ID,
    [
      {
        blocks: [
          block('title', 'paragraph', 'Screening visit'),
          block('cc', 'heading', 'Chief complaint'),
          block('cc-body', 'paragraph', 'Synthetic fatigue for two weeks'),
          block('plan', 'heading', 'Plan'),
          block('plan-body', 'paragraph', 'Synthetic follow-up in one month'),
        ],
        usage: { latencyMs: 0 },
      },
    ],
    [],
    embed
  )
  assert.deepEqual(
    chunks.map(({ section, text, source }) => [
      section,
      text,
      source.map((s) => s.blockId),
    ]),
    [
      [null, 'Screening visit', ['title']],
      ['Chief complaint', 'Synthetic fatigue for two weeks', ['cc-body']],
      ['Plan', 'Synthetic follow-up in one month', ['plan-body']],
    ]
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
    await assert.rejects(buildNoteChunks(DOCUMENT_ID, pages, spans, embedder), {
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
  assert.deepEqual(await indexDocumentNotes(DOCUMENT_ID, deps), {
    chunkCount: 1,
  })
  assert.deepEqual(rows[0]?.removedByRedactionIds, ['face'])
  await assert.rejects(
    indexDocumentNotes(DOCUMENT_ID, {
      ...deps,
      embed: async () => {
        throw new Error('Synthetic private text')
      },
    }),
    { message: 'Note indexing failed' }
  )
  assert.equal(writes, 1)
})

test('filters page furniture and placeholder-only text, preserving clinical headings and lists', () => {
  const block = { id: 'synthetic', box, continues: null }
  for (const kind of ['header', 'footer'] as const) {
    assert.equal(
      isSearchableNoteBlock({
        ...block,
        kind,
        text: 'Synthetic page furniture',
      }),
      false
    )
  }
  for (const text of [
    ' ',
    '[REDACTED] [REDACTED]',
    ' : [REDACTED] - ',
    '1',
    'Page 2',
    '2 of 3',
    '2 / 3',
  ]) {
    assert.equal(
      isSearchableNoteBlock({ ...block, kind: 'other', text }),
      false
    )
  }
  for (const kind of ['heading', 'paragraph', 'list', 'table'] as const) {
    assert.equal(
      isSearchableNoteBlock({
        ...block,
        kind,
        text: 'Assessment: stable [REDACTED]',
      }),
      true
    )
  }
})

test('does not embed masked-only blocks or page furniture', async () => {
  const blocks = [
    {
      id: 'name',
      kind: 'paragraph' as const,
      text: 'Synthetic Person',
      box,
      continues: null,
    },
    {
      id: 'header',
      kind: 'header' as const,
      text: 'Patient: Synthetic Person',
      box,
      continues: null,
    },
    {
      id: 'footer',
      kind: 'footer' as const,
      text: 'SYNTHETIC - NOT A PATIENT RECORD',
      box,
      continues: null,
    },
    {
      id: 'page',
      kind: 'other' as const,
      text: 'Page 1',
      box,
      continues: null,
    },
  ]

  assert.deepEqual(
    await buildNoteChunks(
      DOCUMENT_ID,
      [{ blocks, usage: { latencyMs: 0 } }],
      [{ page: 1, blockId: 'name', start: 0, end: 16 }],
      async () => {
        throw new Error('must not embed')
      }
    ),
    []
  )
})

const block = (
  id: string,
  text: string,
  kind: 'heading' | 'paragraph' = 'paragraph',
  level?: 1 | 2
) => ({ id, text, kind, level, box, continues: null })

const page = (...blocks: OcrPage['blocks']): OcrPage => ({
  blocks,
  usage: { latencyMs: 0 },
})

test('builds paths from title and section, folds empty headings, and carries paths across pages', async () => {
  const chunks = await buildNoteChunks(
    DOCUMENT_ID,
    [
      page(
        block('title', 'Screening visit', 'heading', 1),
        block('cc', 'Chief complaint', 'heading', 2),
        block('body', 'Synthetic fatigue.')
      ),
      page(
        block('continued', 'Synthetic continued fatigue.'),
        block('plan', 'Plan', 'heading'),
        block('plan-body', 'Synthetic follow-up.'),
        block('empty', 'Empty heading', 'heading')
      ),
      page(
        block('new-title', 'Follow-up visit', 'heading', 1),
        block('new-body', 'Synthetic stable.')
      ),
    ],
    [],
    embed
  )
  assert.deepEqual(
    chunks.map(({ section, text, source }) => [section, text, source[0]?.page]),
    [
      ['Screening visit › Chief complaint', 'Synthetic fatigue.', 1],
      ['Screening visit › Chief complaint', 'Synthetic continued fatigue.', 2],
      ['Screening visit › Plan', 'Synthetic follow-up.', 2],
      ['Follow-up visit', 'Synthetic stable.', 3],
    ]
  )
})

test('embeds the section path with body or just the body when no section exists', () => {
  assert.equal(
    noteEmbeddingInput({ section: 'Visit › Plan', text: 'Rest.' }),
    '[Visit › Plan]\nRest.'
  )
  assert.equal(noteEmbeddingInput({ section: null, text: 'Rest.' }), 'Rest.')
  assert.equal(noteEmbeddingInput({ text: 'Rest.' }), 'Rest.')
})

test('splits long sections at blocks then sentences, preserving abbreviations and sentence overlap', async () => {
  const sentence = 'Dr. Sample prescribed 7.8 mg. b.i.d. e.g. with meals.'
  const first = `${'Synthetic context '.repeat(80)}ends here.`
  const second = Array.from({ length: 35 }, () => sentence).join(' ')
  const chunks = await buildNoteChunks(
    DOCUMENT_ID,
    [
      page(
        block('heading', 'Plan', 'heading'),
        block('first', first),
        block('second', second),
        block('next', 'Assessment', 'heading'),
        block('last', 'Stable.')
      ),
    ],
    [],
    async (values) => {
      assert.ok(
        values.every(
          (value) =>
            value.startsWith('[Plan]\n') || value === '[Assessment]\nStable.'
        )
      )
      return embed(values)
    }
  )
  const plan = chunks.filter(({ section }) => section === 'Plan')
  assert.ok(plan.length > 1)
  assert.equal(plan[0]?.text, first)
  assert.ok(plan.every(({ text }) => text.length <= 2000))
  for (let i = 1; i < plan.length; i++) {
    const previous = plan[i - 1]?.text ?? ''
    const overlap = i === 1 ? first : sentence
    assert.ok(previous.endsWith(overlap))
    assert.ok(plan[i]?.text.startsWith(overlap))
  }
  assert.equal(chunks.at(-1)?.text, 'Stable.')
  assert.ok(
    plan.every(
      ({ text }) =>
        !text.includes('\nSample') &&
        !text.includes('\nb.i.d.') &&
        !text.includes('\nwith meals')
    )
  )
})

test('parses legacy OCR headings without a level and rejects unsupported levels', () => {
  const legacy = {
    id: 'legacy',
    kind: 'heading',
    text: 'Synthetic visit',
    box,
    continues: null,
  }
  assert.equal(blockSchema.parse(legacy).level, undefined)
  for (const level of [1, 2])
    assert.equal(blockSchema.parse({ ...legacy, level }).level, level)
  assert.equal(blockSchema.safeParse({ ...legacy, level: 3 }).success, false)
})

test('keeps oversized tables whole and restricts overlap sources to the contributing blocks', async () => {
  const table = `Test Result\n${'Synthetic value 7.8\n'.repeat(150)}`.trim()
  const chunks = await buildNoteChunks(
    DOCUMENT_ID,
    [
      page(
        block('heading', 'Labs', 'heading'),
        { ...block('table', table), kind: 'table' },
        block('next-heading', 'Plan', 'heading'),
        block('a', `${'Synthetic context '.repeat(90)}ends here.`),
        block('b', 'Synthetic monitoring sentence. '.repeat(20)),
        block('c', 'Synthetic follow-up sentence. '.repeat(90))
      ),
    ],
    [],
    embed
  )
  assert.equal(chunks[0]?.text, table)
  assert.equal(chunks[0]?.section, 'Labs')
  const last = chunks.at(-1)
  assert.ok(last?.source.every(({ blockId }) => blockId === 'c'))
})
