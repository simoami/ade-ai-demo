import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dedupeRegions } from '#stages/redact/dedupe-regions'
import { placeRedactions } from '#stages/redact/place-redactions'
import type { RedactionRegion } from '#stages/redact/redaction-types'

const large: RedactionRegion = {
  page: 1,
  blockId: 'p1-b1',
  category: 'phone',
  box: { x: 0.1, y: 0.1, width: 0.4, height: 0.1 },
  points: [],
  state: 'applied',
  source: 'text',
}

const tiny: RedactionRegion = {
  ...large,
  category: 'id',
  box: { x: 0.2, y: 0.12, width: 0.006, height: 0.003 },
}

test('drops contained tiny regions and preserves original survivor order', () => {
  assert.deepEqual(dedupeRegions([tiny, large]), [large])
  assert.deepEqual(dedupeRegions([large, tiny]), [large])
  assert.deepEqual(dedupeRegions([large, { ...large }]), [large])
})

test('keeps separate regions and regions on different pages', () => {
  const separate = { ...tiny, box: { ...tiny.box, x: 0.8 } }
  const otherPage = { ...tiny, page: 2 }
  assert.deepEqual(dedupeRegions([large, separate, otherPage]), [
    large,
    separate,
    otherPage,
  ])
})

test('drops text at 90% coverage but keeps it below the threshold', () => {
  const covered = {
    ...large,
    box: { x: 0.14, y: 0.1, width: 0.4, height: 0.1 },
  }
  const uncovered = { ...covered, box: { ...covered.box, x: 0.15 } }
  assert.deepEqual(dedupeRegions([large, covered]), [large])
  assert.deepEqual(dedupeRegions([large, uncovered]), [large, uncovered])
})

test('requires full picture coverage by text and prefers pictures for equal boxes', () => {
  const picture: RedactionRegion = {
    ...large,
    category: 'patientPhoto',
    source: 'picture',
    box: { x: 0.11, y: 0.1, width: 0.4, height: 0.09 },
  }
  assert.deepEqual(dedupeRegions([large, picture]), [large, picture])
  assert.deepEqual(dedupeRegions([large, { ...tiny, source: 'picture' }]), [
    large,
  ])
  const equal = { ...picture, box: large.box }
  assert.deepEqual(dedupeRegions([large, equal]), [equal])
  assert.deepEqual(dedupeRegions([picture, tiny]), [picture])
})

test('deduplicates placed picture identifiers before returning regions', async () => {
  const regions = await placeRedactions(
    {
      pageNumber: 1,
      image: new Uint8Array(),
      width: 1000,
      height: 1000,
      ocr: {
        blocks: [
          {
            id: 'p1-b1',
            kind: 'figure',
            text: '',
            box: large.box,
            continues: null,
          },
        ],
        usage: { latencyMs: 0 },
      },
    },
    [],
    [
      {
        page: 1,
        blockId: 'p1-b1',
        kind: 'patientPhoto',
        decision: 'redact',
        confidence: 1,
        identifiers: [{ category: 'phone', box: tiny.box }],
      },
    ]
  )
  assert.equal(regions.length, 1)
  assert.equal(regions[0]?.category, 'patientPhoto')
})
