import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { logger } from '@repo/logger'
import { Eval } from 'braintrust'
import { type Expected, expectedSchema } from '#evals/fixtures/expected'
import {
  exceedsDemographicsCeilings,
  fieldAccuracy,
  isWrongStrongLink,
  scoreDemographicFields,
} from '#evals/scorers/demographics'
import { models } from '#models'
import {
  matchPatient,
  type PatientHashes,
} from '#stages/demographics/match-patient'
import { PROMPT_VERSION } from '#stages/demographics/prompt'
import {
  type Demographics,
  hashDemographics,
  readDemographics,
} from '#stages/demographics/read-demographics'

const log = logger.getSubLogger({ name: 'demographics-eval' })

const root = new URL('../../../fixtures/synthetic/', import.meta.url)

// A fresh key per run: scores compare hashes, and no hash outlives the run.
const key = randomBytes(32).toString('base64')

/** The patient is the most frequent name span; its first and last tokens are the given and family names. */
function truth(fixture: Expected): Demographics {
  const spans = fixture.pages.flatMap((page) => page.pii)
  const counts = new Map<string, number>()
  for (const span of spans.filter((span) => span.category === 'name'))
    counts.set(
      span.text.toLowerCase(),
      (counts.get(span.text.toLowerCase()) ?? 0) + 1
    )
  const name = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0].split(/\s+/)
  const unique = (category: 'dob' | 'id') => {
    const values = new Set(
      spans
        .filter((span) => span.category === category)
        .map((span) => span.text)
    )
    if (values.size !== 1) throw new Error('Ambiguous demographics truth')
    return [...values][0]
  }
  if (!name || name.length < 2) throw new Error('Missing patient name truth')
  return {
    firstName: name[0],
    lastName: name.at(-1),
    birthDate: unique('dob'),
    mrn: unique('id'),
  }
}

const fixtures = await Promise.all(
  (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort()
    .map(async (id) =>
      expectedSchema.parse(
        JSON.parse(await readFile(new URL(`${id}/expected.json`, root), 'utf8'))
      )
    )
)
const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
const truthOf = (id: string) => {
  const fixture = byId.get(id)
  if (!fixture) throw new Error('Missing patient fixture')
  return truth(fixture)
}

// Bex as in clinical-01; Cora as in clinical-03 with a different birth date, so
// Cora's other documents only partially match. Every fixture shares one birth
// date, so Aven's documents partially match Bex.
const patient = (id: string, demographics: Demographics): PatientHashes => {
  const hashes = hashDemographics(demographics, key)
  return {
    id,
    lastNameHash: hashes.lastName ?? null,
    firstNameHash: hashes.firstName ?? null,
    birthDateHash: hashes.birthDate ?? null,
    mrnHash: hashes.mrn ?? null,
    sex: 'Unknown',
  }
}
const patients = [
  patient('clinical-01', truthOf('clinical-01')),
  patient('clinical-03', {
    ...truthOf('clinical-03'),
    birthDate: '1980-01-01',
  }),
]

// Clinical and consent fixtures name their patient; held-out ones are scored, never tuned on.
const data = fixtures
  .filter((fixture) => fixture.documentClass !== 'other')
  .map((fixture) => {
    if (fixture.datasetVersion !== 'synthetic-v5')
      throw new Error('Invalid demographics fixture')
    const hashes = hashDemographics(truth(fixture), key)
    return {
      input: {
        fixtureId: fixture.id,
        pages: fixture.pages.map((page) => ({
          blocks: page.blocks,
          usage: { latencyMs: 0 },
        })),
      },
      expected: {
        hashes,
        match: matchPatient({ hashes, sex: null }, patients),
      },
      metadata: {
        datasetVersion: fixture.datasetVersion,
        split: fixture.split,
      },
    }
  })

const metadata = {
  promptVersion: PROMPT_VERSION,
  model: models.pipeline.modelId,
  datasetVersion: 'synthetic-v5',
  gitSha: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  documentCount: data.length,
}

const result = await Eval(
  'ade-document-stages',
  {
    experimentName: `demographics-${PROMPT_VERSION}-${Date.now()}`,
    metadata,
    data,
    maxConcurrency: 4,
    // Only hashes leave the task, as in the workflow step.
    task: async (input) => {
      const demographics = await readDemographics(input.pages)
      const hashes = hashDemographics(demographics, key)
      return {
        hashes,
        sex: demographics.sex ?? null,
        match: matchPatient({ hashes, sex: null }, patients),
      }
    },
    scores: [
      ({ expected, output }) => {
        if (!expected) throw new Error('Missing demographics truth')
        const fields = scoreDemographicFields(expected.hashes, output.hashes)
        return [
          ...Object.entries(fields).map(([field, correct]) => ({
            name: `${field}Accuracy`,
            score: correct ? 1 : 0,
          })),
          {
            name: 'matchAccuracy',
            score:
              expected.match.patientId === output.match.patientId &&
              expected.match.strength === output.match.strength
                ? 1
                : 0,
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

const failedFixtureIds = result.results
  .filter((row) => row.error || !row.output)
  .map((row) => row.input.fixtureId)
const cases = result.results.flatMap((row) => {
  if (!row.expected) throw new Error('Missing demographics truth')
  if (row.error || !row.output) return []
  return [
    {
      fixtureId: row.input.fixtureId,
      split: row.metadata?.split,
      fields: scoreDemographicFields(row.expected.hashes, row.output.hashes),
      sex: row.output.sex,
      expectedMatch: row.expected.match,
      actualMatch: row.output.match,
      wrongStrongLink: isWrongStrongLink(row.expected.match, row.output.match),
    },
  ]
})
const accuracy = fieldAccuracy(cases.map((row) => row.fields))
const matchAccuracy =
  cases.filter(
    (row) =>
      row.expectedMatch.patientId === row.actualMatch.patientId &&
      row.expectedMatch.strength === row.actualMatch.strength
  ).length / data.length
const wrongStrongLinks = cases.filter((row) => row.wrongStrongLink).length

const report = {
  metadata,
  experimentUrl: result.summary.experimentUrl,
  failedFixtureIds,
  fieldAccuracy: accuracy,
  matchAccuracy,
  wrongStrongLinks,
  cases,
}

await mkdir(new URL('./results/', import.meta.url), { recursive: true })
await writeFile(
  new URL('./results/demographics-latest.json', import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`
)
log.info(
  {
    experimentUrl: report.experimentUrl,
    fieldAccuracy: accuracy,
    matchAccuracy,
    wrongStrongLinks,
    failedFixtureIds,
  },
  'Demographics evaluation completed'
)

if (
  failedFixtureIds.length ||
  exceedsDemographicsCeilings(accuracy, wrongStrongLinks)
)
  throw new Error('Demographics evaluation exceeds error ceilings')
