import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { expectedSchema } from '#evals/fixtures/expected'
import {
  exceedsClassifyCeilings,
  scoreClassification,
  summaryLeaksIdentifier,
} from '#evals/scorers/classify'
import { models } from '#models'
import { classifyDocument } from '#stages/classify/classify-document'
import { PROMPT_VERSION } from '#stages/classify/prompt'

const log = logger.getSubLogger({ name: 'classify-eval' })

const root = new URL('../../../fixtures/synthetic/', import.meta.url)

// Every fixture, held-out included, using ground-truth blocks to isolate classification from OCR.
const data = await Promise.all(
  (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort()
    .map(async (id) => {
      const fixture = expectedSchema.parse(
        JSON.parse(await readFile(new URL(`${id}/expected.json`, root), 'utf8'))
      )
      if (fixture.id !== id || fixture.datasetVersion !== 'synthetic-v3')
        throw new Error('Invalid classification fixture')
      return {
        input: {
          fixtureId: id,
          pages: fixture.pages.map((page) => ({
            blocks: page.blocks,
            usage: { latencyMs: 0 },
          })),
        },
        expected: {
          documentClass: fixture.documentClass,
          identifiers: fixture.pages.flatMap((page) =>
            page.pii.map((span) => span.text)
          ),
        },
        metadata: {
          datasetVersion: fixture.datasetVersion,
          split: fixture.split,
        },
      }
    })
)

const metadata = {
  promptVersion: PROMPT_VERSION,
  model: models.fast.modelId,
  datasetVersion: 'synthetic-v3',
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  documentCount: data.length,
}

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `classify-${PROMPT_VERSION}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 4,
    task: (input) => classifyDocument(input.pages),
    scores: [
      ({ expected, output }) => {
        if (!expected) throw new Error('Missing classification truth')
        return [
          {
            name: 'classAccuracy',
            score: output.documentClass === expected.documentClass ? 1 : 0,
          },
          {
            name: 'summaryWithoutIdentifiers',
            score: summaryLeaksIdentifier(
              output.consentSummary,
              expected.identifiers
            )
              ? 0
              : 1,
          },
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

const cases = result.results.map((row) => ({
  fixtureId: row.input.fixtureId,
  split: row.metadata?.split,
  expected: row.expected?.documentClass,
  actual: row.error ? null : (row.output?.documentClass ?? null),
  confidence: row.error ? null : (row.output?.confidence ?? null),
  summaryLeak: summaryLeaksIdentifier(
    row.error ? null : (row.output?.consentSummary ?? null),
    row.expected?.identifiers ?? []
  ),
}))

const scores = scoreClassification(
  cases.flatMap((row) =>
    row.expected ? [{ expected: row.expected, actual: row.actual }] : []
  )
)
const summaryLeaks = cases.filter((row) => row.summaryLeak).length

const report = {
  metadata,
  experimentUrl: result.summary.experimentUrl,
  failedFixtureIds: cases
    .filter((row) => row.actual === null)
    .map((row) => row.fixtureId),
  ...scores,
  summaryLeaks,
  cases,
}

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('./results/classify-latest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
log.info(
  {
    experimentUrl: report.experimentUrl,
    accuracy: scores.accuracy,
    macroF1: scores.macroF1,
    summaryLeaks,
    failedFixtureIds: report.failedFixtureIds,
  },
  'Classification evaluation completed'
)

if (
  report.failedFixtureIds.length ||
  exceedsClassifyCeilings(scores.accuracy, summaryLeaks)
)
  throw new Error('Classification evaluation exceeds error ceilings')
