import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { logger } from '@repo/logger'
import { embedMany } from 'ai'
import { Eval } from 'braintrust'
import { selectNoteMatches } from '#chat/note-matches'
import { expectedSchema } from '#evals/fixtures/expected'
import { scoreNoteRecall } from '#evals/scorers/notes'
import { embeddingModel } from '#models'
import { buildNoteChunks } from '#workflows/ingest-document/index-notes'

const log = logger.getSubLogger({ name: 'notes-eval' })

const fixtureIds = [
  'clinical-20',
  'clinical-followup',
  'intake-01',
  'referral-01',
  'radiology-01',
  'consent-01',
]

const chunks = (
  await Promise.all(
    fixtureIds.map(async (fixtureId) => {
      const fixture = expectedSchema.parse(
        JSON.parse(
          await readFile(
            new URL(
              `../../../fixtures/synthetic/${fixtureId}/expected.json`,
              import.meta.url
            ),
            'utf8'
          )
        )
      )

      const spans = fixture.pages.flatMap((page, index) =>
        page.pii.flatMap((span) =>
          'blockId' in span
            ? [
                {
                  page: index + 1,
                  blockId: span.blockId,
                  start: span.start,
                  end: span.end,
                },
              ]
            : []
        )
      )

      return (
        await buildNoteChunks(
          randomUUID(),
          fixture.pages.map((page) => ({
            blocks: page.blocks,
            usage: { latencyMs: 0 },
          })),
          spans
        )
      ).map((chunk) => ({ ...chunk, fixtureId }))
    })
  )
).flat()

const questions = [
  [
    'radiology-01',
    'Radiology report',
    1,
    'What did the chest X-ray show about the lungs and heart?',
  ],
  [
    'radiology-01',
    'Radiology report',
    1,
    'Was there pleural effusion or pneumothorax?',
  ],
  [
    'intake-01',
    'Patient intake form',
    1,
    'What allergies and current medications were reported at intake?',
  ],
  [
    'intake-01',
    'Patient intake form',
    1,
    'How should messages be sent to the patient?',
  ],
  [
    'referral-01',
    'Specialist referral',
    1,
    'Why was ambulatory rhythm monitoring requested?',
  ],
  [
    'referral-01',
    'Specialist referral',
    2,
    'When and where does the community wellness program offer blood pressure checks?',
  ],
  [
    'clinical-followup',
    'Clinical encounter record',
    1,
    'What is the metformin dose and frequency?',
  ],
  [
    'clinical-followup',
    'Clinical encounter record',
    1,
    'What was the outcome of the severe dehydration hospitalization?',
  ],
  [
    'clinical-20',
    'Labs collected 2026-02-11',
    2,
    'What glucose and sodium results were collected on 2026-02-11?',
  ],
  [
    'consent-01',
    'Consent to synthetic care',
    1,
    'Which evaluation and data review activities were authorized?',
  ],
] as const

const { embeddings } = await embedMany({
  model: embeddingModel,
  values: questions.map((row) => row[3]),
  maxRetries: 0,
})

const metadata = {
  datasetVersion: 'synthetic-v5',
  model:
    typeof embeddingModel === 'string'
      ? embeddingModel
      : embeddingModel.modelId,
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  chunkCount: chunks.length,
}

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `notes-v1-${Date.now()}`,
    metadata,
    data: questions.map(([fixtureId, section, page, query], index) => ({
      input: { index, query },
      expected: { fixtureId, section, page },
    })),
    task: ({ index }) => {
      const query = embeddings[index]
      if (!query) throw new Error('Missing query embedding')

      return selectNoteMatches(
        chunks.map((chunk) => {
          const vector = chunk.embedding
          if (!vector) throw new Error('Missing chunk embedding')

          const dot = vector.reduce(
            (sum, value, i) => sum + value * (query[i] ?? 0),
            0
          )
          const norm = Math.hypot(...vector) * Math.hypot(...query)

          return {
            fixtureId: chunk.fixtureId,
            section: chunk.section ?? null,
            page: chunk.source[0]?.page ?? 0,
            distance: 1 - dot / norm,
          }
        })
      )
    },
    scores: [
      ({ expected, output }) => {
        if (!expected) throw new Error('Missing note retrieval truth')
        return { name: 'recallAt4', score: scoreNoteRecall(expected, output) }
      },
    ],
  },
  {
    noSendLogs: !process.env.BRAINTRUST_API_KEY?.trim(),
    reporter: {
      name: 'metadata-only',
      reportEval: () => true,
      reportRun: (reports) => reports.every(Boolean),
    },
  }
)

const report = {
  metadata,
  experimentUrl: result.summary.experimentUrl,
  questionCount: questions.length,
  recallAt4:
    result.results.reduce(
      (sum, row) =>
        sum +
        (row.expected && row.output && !row.error
          ? scoreNoteRecall(row.expected, row.output)
          : 0),
      0
    ) / questions.length,
  failedQuestionIds: result.results
    .filter((row) => row.error || !row.output)
    .map((row) => row.input.index),
}

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('./results/notes-latest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
log.info(report, 'Note retrieval evaluation completed')
