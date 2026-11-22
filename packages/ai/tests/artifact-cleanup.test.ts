import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cleanupDocumentArtifacts,
  selectArtifactDeletions,
} from '#workflows/ingest-document/artifact-cleanup'

const prefix = 'documents/id/'
const published = [
  'pages/1-v2.webp',
  'pages/1-v2-thumb.webp',
  'pages/2-v2.webp',
]
const transient = [
  'ocr.json.enc',
  'redaction/manifest.json.enc',
  'redaction/checkpoint/1.enc',
  'redaction/source/1.png.enc',
  'render/1.png',
  'render/1-thumb.webp',
  'pages/1-v1.webp',
  'pages/1-v1-thumb.webp',
  'pages/1-v20.webp',
  'pages/1-v2.webp.enc',
  'pages/0-v2.webp',
  'pages/nested/1-v2.webp',
]

const paths = (names: string[]) => names.map((name) => `${prefix}${name}`)

test('keeps only exact published page pairs within the document prefix', () => {
  assert.deepEqual(
    selectArtifactDeletions('id', 2, [
      ...paths(published),
      ...paths(transient),
      'documents/id-other/ocr.json.enc',
      'documents/other/pages/1-v1.webp',
      'uploads/other.pdf',
    ]),
    paths(transient)
  )
})

test('deletes every artifact for a discarded unsupported document without a published version', () => {
  const listing = paths([...published, ...transient])

  assert.deepEqual(selectArtifactDeletions('id', null, listing), listing)
})

test('cleans all listing pages and every original after terminal review, and can retry', async () => {
  for (const status of ['reviewed', 'discarded'] as const) {
    for (const pageVersion of [2, null]) {
      const originals = ['uploads/first.png', 'uploads/second.png']
      const blobs = new Set([
        ...originals,
        ...paths([...published, ...transient]),
      ])
      const cursors: (string | undefined)[] = []
      const deps = {
        find: async () => ({
          status,
          pageVersion,
          originalPathname: originals[0] ?? '',
        }),
        storage: {
          list: async (scope: string, cursor?: string) => {
            assert.equal(scope, prefix)
            cursors.push(cursor)

            return {
              blobs: paths(cursor ? transient : published)
                .filter((pathname) => blobs.has(pathname))
                .map((pathname) => ({
                  pathname,
                  url: '',
                  downloadUrl: '',
                  size: 1,
                  uploadedAt: new Date(),
                  etag: '',
                })),
              hasMore: !cursor,
              cursor: cursor ? undefined : 'next',
            }
          },
          delete: async (names: string | string[]) => {
            for (const name of [names].flat()) blobs.delete(name)
          },
        },
      }

      await cleanupDocumentArtifacts('id', originals, deps)
      assert.deepEqual([...blobs], pageVersion === null ? [] : paths(published))
      assert.deepEqual(cursors, [undefined, 'next'])
      await cleanupDocumentArtifacts('id', originals, deps)
      assert.deepEqual([...blobs], pageVersion === null ? [] : paths(published))
    }
  }
})

test('refuses cleanup before terminal status and propagates storage failures for retry', async () => {
  const deps = {
    find: async () => ({
      status: 'needsReview' as const,
      pageVersion: 2,
      originalPathname: 'uploads/first.png',
    }),
    storage: {
      list: async () => ({ blobs: [], hasMore: false }),
      delete: async () => {
        throw new Error('Storage unavailable')
      },
    },
  }

  await assert.rejects(cleanupDocumentArtifacts('id', [], deps), /not terminal/)
  await assert.rejects(
    cleanupDocumentArtifacts('id', [], {
      ...deps,
      find: async () => undefined,
    }),
    /not found/
  )
  await assert.rejects(
    cleanupDocumentArtifacts('id', [], {
      ...deps,
      find: async () => ({
        status: 'discarded',
        pageVersion: null,
        originalPathname: 'uploads/first.png',
      }),
    }),
    /Storage unavailable/
  )
})

test('retries partial cleanup after originals and an earlier listing page were deleted', async () => {
  const originalPathname = 'uploads/first.png'
  const blobs = new Set([originalPathname, ...paths(transient)])
  let failListing = true
  const deps = {
    find: async () => ({
      status: 'reviewed' as const,
      pageVersion: 2,
      originalPathname,
    }),
    storage: {
      list: async (_prefix: string, cursor?: string) => {
        if (cursor && failListing) throw new Error('Listing unavailable')

        return {
          blobs: paths(cursor ? transient.slice(1) : transient.slice(0, 1))
            .filter((pathname) => blobs.has(pathname))
            .map((pathname) => ({
              pathname,
              url: '',
              downloadUrl: '',
              size: 1,
              uploadedAt: new Date(),
              etag: '',
            })),
          hasMore: !cursor,
          cursor: cursor ? undefined : 'next',
        }
      },
      delete: async (names: string | string[]) => {
        for (const name of [names].flat()) blobs.delete(name)
      },
    },
  }

  await assert.rejects(
    cleanupDocumentArtifacts('id', [originalPathname], deps),
    /Listing unavailable/
  )
  assert.equal(blobs.has(originalPathname), false)
  assert.equal(blobs.has(`${prefix}${transient[0]}`), false)
  assert.ok(blobs.size > 0)

  failListing = false
  await cleanupDocumentArtifacts('id', [originalPathname], deps)
  assert.equal(blobs.size, 0)
})
