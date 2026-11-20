import assert from 'node:assert/strict'
import { test } from 'node:test'
import { retainPageUrls } from './retained-page-urls.ts'

const page = (version: string, token: string) => ({
  src: `https://store.example/documents/123/pages/1-${version}.webp?token=${token}`,
  thumbnail: `https://store.example/documents/123/pages/1-${version}-thumb.webp?token=${token}`,
  width: 100,
  height: 200,
})

test('retains both full images and thumbnails when only the signing query changes', () => {
  const original = page('v1', 'first')
  const first = retainPageUrls(new Map(), [original], 0)
  const next = retainPageUrls(first.retained, [page('v1', 'second')], 5000)
  assert.deepEqual(next.images, [original])
  assert.equal(next.retained.size, 2)
})

test('replaces held URLs after ten minutes without extending their age on refresh', () => {
  const first = retainPageUrls(new Map(), [page('v1', 'first')], 0)
  const second = retainPageUrls(first.retained, [page('v1', 'second')], 599_999)
  const fresh = page('v1', 'fresh')
  assert.deepEqual(retainPageUrls(second.retained, [fresh], 600_000).images, [
    fresh,
  ])
})

test('switches immediately for published versions and render-to-redacted paths', () => {
  const rendered = {
    ...page('v1', 'first'),
    src: 'https://store.example/documents/123/render/1.png?token=first',
  }
  const first = retainPageUrls(new Map(), [rendered], 0)
  const published = page('v2', 'second')
  const next = retainPageUrls(first.retained, [published], 1000)
  assert.deepEqual(next.images, [published])
  assert.equal(next.retained.size, 2)
})

test('keeps page order and new dimensions and releases removed pages', () => {
  const first = retainPageUrls(
    new Map(),
    [page('v1', 'first'), page('v2', 'first')],
    0
  )
  const resized = { ...page('v2', 'second'), width: 150 }
  const next = retainPageUrls(first.retained, [resized], 1000)
  assert.deepEqual(next.images, [{ ...page('v2', 'first'), width: 150 }])
  assert.equal(next.retained.size, 2)
  assert.equal(retainPageUrls(next.retained, [], 2000).retained.size, 0)
})
