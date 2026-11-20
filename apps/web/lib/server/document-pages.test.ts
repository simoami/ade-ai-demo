import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentPages } from './document-pages.ts'

const id = 'f38ac619-f99c-4b98-b4f6-0dc2f892c30c'

test('selects ordered unredacted renders during reading and redacting', () => {
  for (const status of ['reading', 'redacting'] as const) {
    assert.deepEqual(documentPages(id, status, 2), {
      pageImages: [1, 2].map(
        (page) => `/api/files/documents/${id}/render/${page}.png`
      ),
      unredacted: true,
    })
  }
})

test('switches to ordered redacted pages after redaction', () => {
  for (const status of [
    'extracting',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
  ] as const) {
    assert.deepEqual(documentPages(id, status, 2), {
      pageImages: [1, 2].map(
        (page) => `/api/files/documents/${id}/pages/${page}.webp`
      ),
      unredacted: false,
    })
  }
})

test('exposes no images during rendering, after failure, or without page dimensions', () => {
  for (const status of ['rendering', 'failed'] as const) {
    assert.deepEqual(documentPages(id, status, 2), {
      pageImages: [],
      unredacted: false,
    })
  }

  for (const status of [
    'rendering',
    'reading',
    'redacting',
    'extracting',
    'needsReview',
    'reviewed',
    'discarded',
    'unsupported',
    'failed',
  ] as const) {
    assert.deepEqual(documentPages(id, status, 0), {
      pageImages: [],
      unredacted: false,
    })
  }
})
