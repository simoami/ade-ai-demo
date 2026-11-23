import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { syntheticDataset } from '#evals/fixtures/dataset'
import type { ExpectedFigure } from '#evals/fixtures/expected'
import { ocrPageCost } from '#evals/prices'
import { burnedInRecall, scoreFigures } from '#evals/scorers/figures'
import { exceededOcrCeilings, scoreBlocks } from '#evals/scorers/ocr'
import {
  type PiiSpan,
  scorePiiWordBoxes,
  summarizePiiWordBoxes,
} from '#evals/scorers/pii-word-boxes'
import { models } from '#models'
import { datalabOcr } from '#stages/ocr/datalab-ocr'
import { defaultOcrProvider, llmOcr, ocrPages } from '#stages/ocr/ocr-pages'
import type { Block, Box, OcrPage } from '#stages/ocr/ocr-result'
import { PROMPT_VERSION } from '#stages/ocr/prompt'
import { reductoOcr } from '#stages/ocr/reducto-ocr'
import { renderPdf } from '#stages/render/render-pages'

const log = logger.getSubLogger({ name: 'ocr-eval' })

/** Bake-off arms, keyed by the name `EVAL_OCR_PROVIDER` selects. */
const providers = {
  ...Object.fromEntries(
    [models.pipeline, models.fast].map((model) => [
      model.modelId,
      llmOcr(model),
    ])
  ),
  'datalab-balanced': datalabOcr('balanced'),
  'datalab-accurate': datalabOcr('accurate'),
  'reducto-r-1': reductoOcr('r-1'),
  'reducto-r-1-mini': reductoOcr('r-1-mini'),
}

const providerName = process.env.EVAL_OCR_PROVIDER ?? defaultOcrProvider.name

const provider = providers[providerName as keyof typeof providers]

if (!provider)
  throw new Error(
    `EVAL_OCR_PROVIDER must be one of ${Object.keys(providers).join(', ')}`
  )

const dpi = Number(process.env.EVAL_DPI ?? 144)

if (![144, 216].includes(dpi)) throw new Error('EVAL_DPI must be 144 or 216')

const data = (await syntheticDataset()).filter(
  (row) =>
    (!process.env.EVAL_FIXTURE ||
      row.input.fixtureId === process.env.EVAL_FIXTURE) &&
    (!process.env.EVAL_VARIANT ||
      row.input.variant === process.env.EVAL_VARIANT)
)

if (!data.length) throw new Error('No synthetic cases match filters')

const metadata = {
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  promptVersion: PROMPT_VERSION,
  provider: providerName,
  datasetVersion: data[0]?.metadata.datasetVersion,
  dpi,
}

/** Page scores plus figure counts and PII word-box metrics, which are null for providers without words. */
function scorePage(
  expected: {
    blocks: Block[]
    pii: PiiSpan[]
    figures: { kind: ExpectedFigure['kind']; box: Box }[]
    burnedIn: string[]
  },
  page: OcrPage
) {
  return {
    ...scoreBlocks(expected.blocks, page.blocks),
    figures: scoreFigures(expected.figures, page.blocks),
    burnedInRecall: burnedInRecall(expected.burnedIn, page.blocks),
    piiWordBoxes: page.words
      ? scorePiiWordBoxes(expected.pii, page.words)
      : null,
  }
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : null
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const started = performance.now()

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `ocr-${providerName}-${PROMPT_VERSION}-${dpi}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 2,
    task: async (input, { span }) => {
      const directory = await mkdtemp(join(tmpdir(), 'ade-ocr-eval-'))
      try {
        const rendered = await renderPdf(input.pdf, directory, dpi / 72)
        const pages = await ocrPages(
          await Promise.all(
            rendered.pages.map((page) =>
              readFile(join(directory, `${page.page}.png`))
            )
          ),
          provider
        )

        span.log({
          metrics: {
            costUsdPerPage: mean(
              pages.map((page) => ocrPageCost(providerName, page.usage))
            ),
            latencyMsPerPage: mean(pages.map((page) => page.usage.latencyMs)),
          },
        })
        return pages
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
    scores: [
      ({ expected, output }) => {
        if (!expected || output.length !== expected.length)
          throw new Error('OCR page count mismatch')

        const scores = expected.map((page, index) => {
          const actual = output[index]
          if (!actual) throw new Error('OCR page count mismatch')
          return scorePage(page, actual)
        })
        const pageMean = (
          key: 'cer' | 'wer' | 'blockKindAccuracy' | 'boxIoU' | 'readingOrder'
        ) => mean(scores.map((page) => page[key]))
        const wordBoxes = scores.every((page) => page.piiWordBoxes)
          ? summarizePiiWordBoxes(
              scores.flatMap((page) => page.piiWordBoxes ?? [])
            )
          : { coverage: null, overCoverage: null }
        const total = (key: 'expected' | 'output' | 'matched') =>
          scores.reduce((sum, page) => sum + page.figures[key], 0)
        const burnedIn = scores.flatMap((page) =>
          page.burnedInRecall === null ? [] : [page.burnedInRecall]
        )

        return [
          {
            name: 'characterAccuracy',
            score: Math.max(0, 1 - pageMean('cer')),
          },
          { name: 'wordAccuracy', score: Math.max(0, 1 - pageMean('wer')) },
          { name: 'blockKindAccuracy', score: pageMean('blockKindAccuracy') },
          { name: 'boxIoU', score: pageMean('boxIoU') },
          { name: 'readingOrder', score: pageMean('readingOrder') },
          {
            name: 'figureRecall',
            score: ratio(total('matched'), total('expected')),
          },
          {
            name: 'figurePrecision',
            score: ratio(total('matched'), total('output')),
          },
          {
            name: 'burnedInRecall',
            score: burnedIn.length ? mean(burnedIn) : null,
          },
          { name: 'piiWordBoxCoverage', score: wordBoxes.coverage },
          {
            name: 'piiWordBoxPrecision',
            score:
              wordBoxes.overCoverage === null
                ? null
                : 1 - wordBoxes.overCoverage,
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
  variant: row.input.variant,
  split: row.metadata?.split,
  failed: Boolean(row.error),
  pages:
    row.output?.map((page, index) => {
      const expected = row.expected?.[index]
      if (!expected) throw new Error('OCR page count mismatch')

      const { piiWordBoxes, ...scores } = scorePage(expected, page)
      return {
        ...scores,
        piiWordBoxes: piiWordBoxes && summarizePiiWordBoxes(piiWordBoxes),
        piiSpanCount: expected.pii.length,
        wordCount: page.words?.length ?? null,
        latencyMs: page.usage.latencyMs,
        tokens: page.usage.tokens,
        costUsd: ocrPageCost(providerName, page.usage),
      }
    }) ?? [],
}))

const report = { metadata, wallMs: performance.now() - started, cases }

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL(
    `./results/ocr-${providerName}-${dpi}-${Date.now()}.json`,
    import.meta.url
  ),
  `${JSON.stringify(report, null, 2)}\n`
)

for (const row of cases) log.info(row, 'OCR case metrics')
log.info(
  {
    ...metadata,
    experimentUrl: result.summary.experimentUrl,
    wallMs: report.wallMs,
    caseCount: cases.length,
    failureCount: cases.filter((row) => row.failed).length,
  },
  'OCR evaluation completed'
)

if (cases.some((row) => row.failed))
  throw new Error('OCR evaluation contains failed cases')

const exceeded = exceededOcrCeilings(
  cases.flatMap((row) =>
    row.pages.map((page) => ({ ...page, variant: row.variant }))
  )
)

if (exceeded.length)
  throw new Error(`OCR error rates exceed ceilings for ${exceeded.join(', ')}`)
