import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { datalabOcr } from '#stages/ocr/datalab-ocr'

const CHECK_URL = 'https://www.datalab.to/api/v1/convert/request-1'

const completed = {
  status: 'complete',
  success: true,
  cost_breakdown: { final_cost_cents: 0.5 },
  json: {
    children: [
      {
        bbox: [0, 0, 1000, 2000],
        children: [
          {
            id: '/page/0/SectionHeader/0',
            block_type: 'SectionHeader',
            bbox: [100, 200, 600, 260],
            html: '<h1><span data-bbox="100 200 300 260" data-confidence="1">Clinical</span> <span data-bbox="310 200 600 260" data-confidence="0.98">R&amp;D</span></h1>',
          },
          {
            id: '/page/0/Picture/1',
            block_type: 'Picture',
            bbox: [700, 100, 900, 300],
            html: '<img alt="Photo" src="x.png"/><div class="img-description"><p>A generated caption.</p><p class="img-desc">AVEN TESTMERE<br/>FAKE-7314</p></div>',
          },
        ],
      },
    ],
  },
}

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function stubFetch(responses: Response[]) {
  const calls: string[] = []
  globalThis.fetch = async (input) => {
    calls.push(String(input))
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request')
    return response
  }
  return calls
}

test('maps Datalab blocks, word spans and picture text to normalized OCR output, waiting out rate limits', async () => {
  process.env.DATALAB_API_KEY = 'test-key'
  const calls = stubFetch([
    Response.json({ request_check_url: CHECK_URL }),
    new Response(null, { status: 429, headers: { 'retry-after': '0' } }),
    Response.json(completed),
  ])

  const page = await datalabOcr('balanced')(new Uint8Array([1]), {
    pageNumber: 1,
  })

  assert.deepEqual(calls, [
    'https://www.datalab.to/api/v1/convert',
    CHECK_URL,
    CHECK_URL,
  ])
  assert.deepEqual(
    page.blocks.map(({ kind, text }) => ({ kind, text })),
    [
      { kind: 'heading', text: 'Clinical R&D' },
      { kind: 'figure', text: 'AVEN TESTMERE\nFAKE-7314' },
    ]
  )
  assert.deepEqual(page.blocks[0]?.box, {
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.03,
  })
  assert.deepEqual(page.words?.[1], {
    text: 'R&D',
    box: { x: 0.31, y: 0.1, width: 0.29, height: 0.03 },
    confidence: 0.98,
  })
  assert.equal(page.usage.costUsd, 0.005)
})

test('fails with the HTTP status only and on unsuccessful conversions', async () => {
  process.env.DATALAB_API_KEY = 'test-key'
  stubFetch([new Response('echoed document text', { status: 500 })])
  await assert.rejects(
    datalabOcr('balanced')(new Uint8Array([1]), { pageNumber: 1 }),
    { message: 'Datalab responded 500' }
  )

  stubFetch([
    Response.json({ request_check_url: CHECK_URL }),
    Response.json({ status: 'complete', success: false, error: 'bad page' }),
  ])
  await assert.rejects(
    datalabOcr('balanced')(new Uint8Array([1]), { pageNumber: 1 }),
    { message: 'Datalab conversion failed' }
  )
})
