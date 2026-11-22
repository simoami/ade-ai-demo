import assert from 'node:assert/strict'
import { test } from 'node:test'
import { noteSources } from './chat-sources.ts'

const chunk = {
  documentId: 'synthetic-document',
  fileName: 'synthetic.pdf',
  page: 1,
  text: 'Synthetic assessment. '.repeat(20),
  box: { x: 0, y: 0, width: 1, height: 1 },
}

test('deduplicates document pages and bounds excerpts after the answer', () => {
  const sources = noteSources(
    [
      chunk,
      { ...chunk, text: 'Lower ranked duplicate' },
      { ...chunk, page: 2 },
    ],
    {
      page: 'document',
      documentId: chunk.documentId,
    }
  )

  assert.deepEqual(
    sources.map((source) => source.label),
    ['page 1', 'page 2']
  )
  assert.equal(sources[0]?.href, '/documents/synthetic-document?page=1')
  assert.equal(sources[0]?.excerpt.length, 200)
  assert.ok(sources[0]?.excerpt.endsWith('…'))
  assert.ok(sources[0]?.excerpt.startsWith('Synthetic assessment.'))
})

test('labels cross-document sources with filenames and preserves short excerpts', () => {
  const sources = noteSources(
    [
      chunk,
      {
        ...chunk,
        documentId: 'second',
        fileName: 'second.pdf',
        text: ' Stable.\n',
      },
    ],
    {
      page: 'document',
      documentId: chunk.documentId,
    }
  )

  assert.deepEqual(
    sources.map((source) => source.label),
    ['synthetic.pdf, page 1', 'second.pdf, page 1']
  )
  assert.equal(sources[1]?.excerpt, 'Stable.')
  assert.deepEqual(noteSources([], { page: 'patients' }), [])
})
