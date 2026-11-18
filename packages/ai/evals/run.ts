import { readdir } from 'node:fs/promises'
import { logger } from '@repo/logger'

const log = logger.getSubLogger({ name: 'eval-runner' })

const filter = process.argv[2]

try {
  const suites = (await readdir(new URL('./', import.meta.url)))
    .filter(
      (file) =>
        file.endsWith('.eval.ts') && (!filter || file === `${filter}.eval.ts`)
    )
    .sort()
  if (!suites.length) throw new Error('No matching stage suites')
  for (const suite of suites) await import(new URL(suite, import.meta.url).href)
} catch (error) {
  log.error(
    { errorType: error instanceof Error ? error.name : 'UnknownError' },
    'Stage evaluation failed'
  )
  process.exitCode = 1
}
