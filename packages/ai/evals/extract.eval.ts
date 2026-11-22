import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { expectedSchema } from '#evals/fixtures/expected'
import {
  exceedsExtractionCeilings,
  scoreObservations,
} from '#evals/scorers/extract'
import { models } from '#models'
import { extractObservations } from '#stages/extract/extract-observations'
import { promptVersion } from '#stages/extract/prompt'

const log = logger.getSubLogger({ name: 'extract-eval' })

// Development pages cover every observation kind and both BP formats; clinical-20 is left out for cost.
const fixtureIds = [
  'clinical-01',
  'clinical-02',
  'clinical-03',
  'clinical-followup',
]

const data = await Promise.all(
  fixtureIds.map(async (id) => {
    const fixture = expectedSchema.parse(
      JSON.parse(
        await readFile(
          new URL(
            `../../../fixtures/synthetic/${id}/expected.json`,
            import.meta.url
          ),
          'utf8'
        )
      )
    )
    if (
      fixture.split !== 'development' ||
      fixture.datasetVersion !== 'synthetic-v3' ||
      fixture.documentClass !== 'clinical'
    )
      throw new Error('Invalid extraction development fixture')
    return {
      input: {
        fixtureId: id,
        pages: fixture.pages.map((page) => ({
          blocks: page.blocks,
          usage: { latencyMs: 0 },
        })),
        // Whole ground-truth identifier spans are masked, birth years included.
        masked: fixture.pages.flatMap((page, index) =>
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
        ),
      },
      expected: fixture.observations,
      metadata: {
        datasetVersion: fixture.datasetVersion,
        split: fixture.split,
      },
    }
  })
)

const metadata = {
  promptVersion,
  model: models.pipeline.modelId,
  datasetVersion: 'synthetic-v3',
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  pageCount: data.reduce((sum, row) => sum + row.input.pages.length, 0),
}

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `extract-${promptVersion}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 2,
    task: (input) => extractObservations(input.pages, input.masked),
    scores: [
      ({ expected, output }) => {
        if (!expected) throw new Error('Missing extraction truth')
        const score = scoreObservations([{ expected, actual: output }])
        return [
          { name: 'observationRecall', score: score.recall },
          { name: 'observationPrecision', score: score.precision },
          { name: 'fieldAccuracy', score: score.fieldAccuracy },
          { name: 'unitAccuracy', score: score.unitAccuracy },
          { name: 'dedupeAccuracy', score: score.dedupeAccuracy },
        ]
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

const score = scoreObservations(
  result.results.flatMap((row) =>
    row.expected && row.output && !row.error
      ? [{ expected: row.expected, actual: row.output }]
      : []
  )
)

const report = {
  metadata,
  experimentUrl: result.summary.experimentUrl,
  failedFixtureIds: result.results
    .filter((row) => row.error || !row.output)
    .map((row) => row.input.fixtureId),
  score,
}

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('./results/extract-latest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
log.info(report, 'Extraction evaluation completed')

if (report.failedFixtureIds.length || exceedsExtractionCeilings(score))
  throw new Error('Extraction evaluation exceeds error ceilings')
