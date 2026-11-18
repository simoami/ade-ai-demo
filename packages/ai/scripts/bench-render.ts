import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPdf } from '../src/stages/render/render-pages.ts'

const input = fileURLToPath(
  new URL('../../../fixtures/synthetic/clinical-20.pdf', import.meta.url)
)

const output = await mkdtemp(join(tmpdir(), 'ade-render-bench-'))
for (const temperature of ['cold', 'warm'] as const) {
  const result = await renderPdf(input, join(output, temperature))
  console.log(
    JSON.stringify({
      temperature,
      scale: 2,
      dpi: 144,
      thumbnailWidth: 240,
      ...result,
    })
  )
}
