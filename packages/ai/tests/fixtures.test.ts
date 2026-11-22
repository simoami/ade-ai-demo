import assert from 'node:assert/strict'
import { test } from 'node:test'
import { expectedSchema } from '#evals/fixtures/expected'
import {
  fixtureSpecs,
  generateFixture,
  rotateBox,
} from '#scripts/generate-synthetic'

test('same seed produces identical PDF bytes and valid ground truth', async () => {
  const spec = fixtureSpecs[0]
  const first = await generateFixture(spec, 7300)
  const second = await generateFixture(spec, 7300)
  assert.deepEqual(first, second)
  assert.ok(expectedSchema.safeParse(first.expected).success)
  assert.notDeepEqual(first.clean, first.scanned)
  const ids = new Set(
    first.expected.pages.flatMap((page) => page.blocks.map((block) => block.id))
  )
  for (const page of first.expected.pages) {
    assert.ok(Math.abs(page.rotation) >= 1 && Math.abs(page.rotation) <= 3)
    for (const block of page.blocks) {
      if (block.continues) assert.ok(ids.has(block.continues))
      assert.ok(block.box.x + block.box.width <= 1)
      assert.ok(block.box.y + block.box.height <= 1)
    }
    for (const span of page.pii) {
      if (!('blockId' in span)) continue
      const block = page.blocks.find((block) => block.id === span.blockId)
      assert.ok(block)
      assert.equal(block.text.slice(span.start, span.end), span.text)
    }
  }
  assert.ok(
    first.expected.observations.some(
      (observation) => observation.kind === 'adverse-event'
    )
  )
})

test('rotation preserves center and exchanges physical axes at ninety degrees', () => {
  const box = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }
  const rotated = rotateBox(box, 90)
  assert.ok(Math.abs(rotated.width - (0.2 * 792) / 612) < 1e-10)
  assert.ok(Math.abs(rotated.height - (0.2 * 612) / 792) < 1e-10)
})

test('all checked-in synthetic variants validate and have real continuation references', async () => {
  const { syntheticDataset } = await import('#evals/fixtures/dataset')
  const rows = await syntheticDataset()
  assert.equal(rows.length, 34)
  for (const row of rows) {
    const priorIds = new Set<string>()
    for (const { blocks, pii } of row.expected) {
      for (const span of pii) assert.ok(span.text.trim())
      for (const block of blocks) {
        if (block.continues) assert.ok(priorIds.has(block.continues))
        assert.ok(block.box.x + block.box.width <= 1)
        assert.ok(block.box.y + block.box.height <= 1)
      }
      for (const block of blocks) priorIds.add(block.id)
    }
  }
})

test('checked-in fixtures cover two-column pages, dense tables and stamps', async () => {
  const { syntheticDataset } = await import('#evals/fixtures/dataset')
  const blocks = (await syntheticDataset())
    .filter((row) => row.input.variant === 'clean')
    .flatMap((row) => row.expected.flatMap((page) => page.blocks))
  assert.ok(blocks.some((block) => block.kind === 'table' && block.box.x > 0.5))
  assert.ok(
    blocks.some(
      (block) => block.kind === 'table' && block.text.split('\n').length > 10
    )
  )
  assert.ok(blocks.some((block) => block.kind === 'other'))
})

test('checked-in fixtures cover every figure kind and redaction decision', async () => {
  const { syntheticDataset } = await import('#evals/fixtures/dataset')
  const pages = (await syntheticDataset())
    .filter((row) => row.input.variant === 'clean')
    .flatMap((row) => row.expected)
  const figures = pages.flatMap((page) => page.figures)

  assert.deepEqual(
    new Set(figures.map((figure) => figure.kind)),
    new Set([
      'patientPhoto',
      'face',
      'signature',
      'logo',
      'icon',
      'medicalImage',
      'clinicalPhoto',
    ])
  )
  assert.deepEqual(
    new Set(figures.map((figure) => figure.redaction)),
    new Set(['redact', 'keep', 'review'])
  )
  assert.ok(pages.some((page) => page.burnedIn.length === 3))
  assert.ok(
    pages.every((page) => page.blocks.every((block) => block.kind !== 'figure'))
  )
})
