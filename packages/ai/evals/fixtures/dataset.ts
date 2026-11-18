import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedSchema } from './expected.ts'

/** Loads only the checked-in synthetic root; no caller-supplied paths are accepted. */
export async function syntheticDataset() {
  const root = fileURLToPath(
    new URL('../../../../fixtures/synthetic/', import.meta.url)
  )
  const rows = []

  for (const entry of (await readdir(root, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const fixture = expectedSchema.parse(
      JSON.parse(
        await readFile(join(root, entry.name, 'expected.json'), 'utf8')
      )
    )

    if (fixture.id !== entry.name)
      throw new Error('Fixture directory does not match ID')

    for (const variant of ['clean', 'scanned'] as const) {
      rows.push({
        input: {
          fixtureId: fixture.id,
          variant,
          pdf: join(root, entry.name, `${variant}.pdf`),
        },
        expected: fixture.pages.map((page) => ({
          blocks: variant === 'clean' ? page.blocks : page.scannedBlocks,
          pii: page.pii.map((span) => {
            const block = page.blocks.find(({ id }) => id === span.blockId)
            if (!block) throw new Error('PII span references a missing block')

            return {
              text: block.text.slice(span.start, span.end),
              box: variant === 'clean' ? span.box : span.scannedBox,
            }
          }),
        })),
        metadata: {
          split: fixture.split,
          datasetVersion: fixture.datasetVersion,
        },
      })
    }
  }

  if (!rows.length) throw new Error('Synthetic dataset is empty')
  return rows
}
