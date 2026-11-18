import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { z } from 'zod'
import { syntheticDataset } from '#evals/fixtures/dataset'
import { isOcrRegression, scoreBlocks } from '#evals/scorers/ocr'
import { models } from '#models'
import { ocrPages } from '#stages/ocr/ocr-pages'
import { promptVersion } from '#stages/ocr/prompt'
import { renderPdf } from '#stages/render/render-pages'

const log = logger.getSubLogger({ name: 'ocr-eval' })

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
  promptVersion,
  modelId: models.pipeline.modelId,
  datasetVersion: data[0]?.metadata.datasetVersion,
  dpi,
}

const baseline = z
  .object({
    cer: z.number().nonnegative(),
    wer: z.number().nonnegative(),
    blockKindAccuracy: z.number().min(0).max(1),
    boxIoU: z.number().min(0).max(1),
  })
  .parse(
    JSON.parse(
      await readFile(new URL('./ocr-baseline.json', import.meta.url), 'utf8')
    )
  )

const started = performance.now()

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `ocr-${promptVersion}-${dpi}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 2,
    task: async (input) => {
      const directory = await mkdtemp(join(tmpdir(), 'ade-ocr-eval-'))
      try {
        const rendered = await renderPdf(input.pdf, directory, dpi / 72)
        return await ocrPages(
          await Promise.all(
            rendered.pages.map((page) =>
              readFile(join(directory, `${page.page}.png`))
            )
          )
        )
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
    scores: [
      ({ expected, output }) => {
        if (!expected || output.length !== expected.length)
          throw new Error('OCR page count mismatch')
        const scores = expected.map((blocks, index) =>
          scoreBlocks(blocks, output[index]?.blocks ?? [])
        )
        const mean = (key: keyof (typeof scores)[number]) =>
          scores.reduce((sum, page) => sum + page[key], 0) / scores.length
        return [
          { name: 'characterAccuracy', score: Math.max(0, 1 - mean('cer')) },
          { name: 'wordAccuracy', score: Math.max(0, 1 - mean('wer')) },
          { name: 'blockKindAccuracy', score: mean('blockKindAccuracy') },
          { name: 'boxIoU', score: mean('boxIoU') },
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
    row.output?.map((page, index) => ({
      ...scoreBlocks(row.expected?.[index] ?? [], page.blocks),
      latencyMs: page.latencyMs,
      inputTokens: page.inputTokens,
      outputTokens: page.outputTokens,
      cachedInputTokens: page.cachedInputTokens,
    })) ?? [],
}))

const report = { metadata, wallMs: performance.now() - started, cases }

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL(`./results/ocr-${dpi}-${Date.now()}.json`, import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
for (const row of cases) log.info(row, 'OCR case metrics')
log.info(
  {
    ...metadata,
    wallMs: report.wallMs,
    caseCount: cases.length,
    failureCount: cases.filter((row) => row.failed).length,
  },
  'OCR evaluation completed'
)
if (cases.some((row) => row.failed))
  throw new Error('OCR evaluation contains failed cases')

if (
  cases.some((row) => row.pages.some((page) => isOcrRegression(page, baseline)))
)
  throw new Error('OCR scores regress outside the measured baseline envelope')
