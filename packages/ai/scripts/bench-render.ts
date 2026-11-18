import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@repo/logger'
import { renderPdf } from '#stages/render/render-pages'

const input = fileURLToPath(
  new URL('../../../fixtures/synthetic/clinical-20/clean.pdf', import.meta.url)
)

const output = await mkdtemp(join(tmpdir(), 'ade-render-bench-'))
for (const temperature of ['cold', 'warm'] as const) {
  const result = await renderPdf(input, join(output, temperature))
  logger.info(
    {
      temperature,
      scale: 2,
      dpi: 144,
      thumbnailWidth: 240,
      ...result,
    },
    'Render benchmark completed'
  )
}
