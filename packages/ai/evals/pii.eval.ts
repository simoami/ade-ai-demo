import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { expectedSchema } from '#evals/fixtures/expected'
import {
  exceedsPiiCeilings,
  scoreIdentifierCharacters,
  scorePictureDecisions,
} from '#evals/scorers/pii'
import { models } from '#models'
import {
  detectIdentifiers,
  reviewPictures,
} from '#stages/pii/detect-identifiers'
import { PROMPT_VERSION } from '#stages/pii/prompt'
import type { IdentifierSpan } from '#stages/redact/redaction-types'
import { renderPdf } from '#stages/render/render-pages'

const log = logger.getSubLogger({ name: 'pii-eval' })

// Ten clean development pages cover the seven fixture identifier categories and picture policy cases.
const fixtureIds = [
  'clinical-01',
  'clinical-03',
  'consent-01',
  'consent-03',
  'fax-01',
  'intake-01',
  'radiology-01',
  'referral-01',
]

const data = await Promise.all(
  fixtureIds.map(async (id) => {
    const root = new URL(`../../../fixtures/synthetic/${id}/`, import.meta.url)
    const fixture = expectedSchema.parse(
      JSON.parse(await readFile(new URL('expected.json', root), 'utf8'))
    )
    if (
      fixture.split !== 'development' ||
      fixture.datasetVersion !== 'synthetic-v3'
    )
      throw new Error('Invalid PII development fixture')
    return {
      input: {
        fixtureId: id,
        pdf: new URL('clean.pdf', root).pathname,
        pages: fixture.pages.map((page) => ({
          blocks: [
            ...page.blocks,
            ...page.figures.map((figure, index) => ({
              id: `p${page.page + 1}-f${index + 1}`,
              kind: 'figure' as const,
              text: '',
              box: figure.box,
              continues: null,
            })),
          ],
          usage: { latencyMs: 0 },
        })),
      },
      expected: {
        spans: fixture.pages.flatMap((page, index) =>
          page.pii.flatMap((span): IdentifierSpan[] =>
            'blockId' in span
              ? [
                  {
                    page: index + 1,
                    blockId: span.blockId,
                    start:
                      span.category === 'dob' && /^\d{4}-/.test(span.text)
                        ? span.start + 5
                        : span.start,
                    end:
                      span.category === 'dob' && !/^\d{4}-/.test(span.text)
                        ? span.end - 5
                        : span.end,
                    category: span.category,
                    confidence: 1,
                  },
                ]
              : []
          )
        ),
        pictures: fixture.pages.flatMap((page, index) => {
          return page.figures.map((figure, figureIndex) => {
            return {
              page: index + 1,
              blockId: `p${index + 1}-f${figureIndex + 1}`,
              decision: figure.redaction,
            }
          })
        }),
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
    experimentName: `pii-${PROMPT_VERSION}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 2,
    task: async (input) => {
      const spans = await detectIdentifiers(input.pages)
      const directory = await mkdtemp(join(tmpdir(), 'ade-pii-eval-'))
      try {
        const hasFigures = input.pages.some((page) =>
          page.blocks.some((block) => block.kind === 'figure')
        )
        if (!hasFigures) return { spans, pictures: [] }
        const rendered = await renderPdf(input.pdf, directory, 2)
        if (rendered.pages.length !== input.pages.length)
          throw new Error('PII page count mismatch')
        const pictures = []
        for (const [index, ocr] of input.pages.entries()) {
          if (!ocr.blocks.some((block) => block.kind === 'figure')) continue
          pictures.push(
            ...(await reviewPictures({
              pageNumber: index + 1,
              ocr,
              image: await readFile(join(directory, `${index}.png`)),
            }))
          )
        }
        return { spans, pictures }
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
    scores: [
      ({ expected, output }) => {
        if (!expected) throw new Error('Missing PII truth')
        const text = scoreIdentifierCharacters(expected.spans, output.spans)
        return [
          { name: 'identifierRecall', score: text.total.recall },
          { name: 'identifierPrecision', score: text.total.precision },
          {
            name: 'pictureDecisionAccuracy',
            score: scorePictureDecisions(expected.pictures, output.pictures)
              .accuracy,
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

const valid = result.results.flatMap((row) =>
  row.output && row.expected && !row.error
    ? [{ expected: row.expected, output: row.output }]
    : []
)

const characters = scoreIdentifierCharacters(
  data.flatMap((row) =>
    row.expected.spans.map((span) => ({
      ...span,
      blockId: `${row.input.fixtureId}:${span.blockId}`,
    }))
  ),
  result.results.flatMap((row) =>
    (row.output?.spans ?? []).map((span) => ({
      ...span,
      blockId: `${row.input.fixtureId}:${span.blockId}`,
    }))
  )
)

const pictures = scorePictureDecisions(
  data.flatMap((row) =>
    row.expected.pictures.map((finding) => ({
      ...finding,
      blockId: `${row.input.fixtureId}:${finding.blockId}`,
    }))
  ),
  result.results.flatMap((row) =>
    (row.output?.pictures ?? []).map((finding) => ({
      ...finding,
      blockId: `${row.input.fixtureId}:${finding.blockId}`,
    }))
  )
)

const report = {
  metadata,
  experimentUrl: result.summary.experimentUrl,
  failureCount: result.results.length - valid.length,
  failedFixtureIds: result.results
    .filter((row) => row.error || !row.output)
    .map((row) => row.input.fixtureId),
  characters,
  pictures,
}

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('./results/pii-latest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
log.info(report, 'PII evaluation completed')

if (
  report.failureCount ||
  exceedsPiiCeilings(
    characters.total.recall,
    characters.total.precision,
    pictures.accuracy
  )
)
  throw new Error('PII evaluation exceeds error ceilings')
