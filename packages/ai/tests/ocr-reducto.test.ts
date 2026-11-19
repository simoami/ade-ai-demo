import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reductoOcr } from '#stages/ocr/reducto-ocr'

const box = { left: 0.1, top: 0.2, width: 0.3, height: 0.05, page: 1 }

const parsed = {
  job_id: 'job-1',
  duration: 1,
  usage: { num_pages: 1 },
  result: {
    type: 'full',
    chunks: [
      {
        content: '',
        embed: '',
        enriched: null,
        blocks: [
          {
            type: 'Table',
            bbox: box,
            content:
              '<table><tr><th>Test</th><th>Flag</th></tr><tr><td>Glucose</td><td>H</td></tr></table>',
            confidence: 'high',
            extra: {
              word_citations: [
                { text: 'Test', char_start: 15, char_end: 19, bbox: box },
                { text: 'Flag', char_start: 28, char_end: 32, bbox: null },
              ],
            },
          },
          {
            type: 'Figure',
            bbox: box,
            content: 'Portrait of a person.',
            confidence: 'high',
          },
        ],
      },
    ],
  },
}

test('maps Reducto blocks and located word citations, leaving figure descriptions out', async () => {
  const paths: string[] = []
  const fetch = async (input: string | URL | Request) => {
    const { pathname } = new URL(input instanceof Request ? input.url : input)
    paths.push(pathname)
    return Response.json(
      pathname === '/upload' ? { file_id: 'reducto://file-1' } : parsed
    )
  }

  const page = await reductoOcr('r-1', {
    apiKey: 'test-key',
    baseURL: 'https://reducto.test',
    fetch,
  })(new Uint8Array([1]), { pageNumber: 2 })

  assert.deepEqual(paths, ['/upload', '/parse'])
  assert.deepEqual(
    page.blocks.map(({ id, kind, text }) => ({ id, kind, text })),
    [
      { id: 'p2-b1', kind: 'table', text: 'Test Flag \nGlucose H' },
      { id: 'p2-b2', kind: 'figure', text: '' },
    ]
  )
  assert.deepEqual(page.words, [
    { text: 'Test', box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 } },
  ])
})
