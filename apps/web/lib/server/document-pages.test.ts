import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentPages } from './document-pages.ts'

const dimensions = [
  { width: 800, height: 400 },
  { width: 400, height: 900 },
]
const sign = async () => async (path: string) => `signed:${path}`

test('signs ordered render pairs with each page proportions only during processing', async () => {
  for (const status of ['reading', 'redacting'] as const) {
    const { pageImages } = await documentPages(
      'id',
      status,
      dimensions,
      null,
      sign
    )
    assert.deepEqual(
      pageImages,
      dimensions.map((size, i) => ({
        ...size,
        src: `signed:documents/id/render/${i + 1}.png`,
        thumbnail: `signed:documents/id/render/${i + 1}-thumb.webp`,
      }))
    )
  }
  for (const status of [
    'rendering',
    'failed',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
    'extracting',
  ] as const) {
    assert.deepEqual(
      await documentPages('id', status, dimensions, null, sign),
      { pageImages: [] }
    )
  }
})

test('prefers published versioned pairs even during redaction and exposes no pages without dimensions', async () => {
  const { pageImages } = await documentPages(
    'id',
    'redacting',
    dimensions,
    3,
    sign
  )
  assert.equal(pageImages[0]?.src, 'signed:documents/id/pages/1-v3.webp')
  assert.equal(
    pageImages[0]?.thumbnail,
    'signed:documents/id/pages/1-v3-thumb.webp'
  )
  assert.deepEqual(await documentPages('id', 'reading', [], null, sign), {
    pageImages: [],
  })
})

test('propagates signing failures', async () => {
  await assert.rejects(
    documentPages('id', 'reading', dimensions, null, async () => async () => {
      throw new Error('signing failed')
    }),
    /signing failed/
  )
})
