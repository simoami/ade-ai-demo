import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MockLanguageModelV4 } from 'ai/test'
import { llmOcr, ocrPages } from '#stages/ocr/ocr-pages'

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

const block = {
  id: 'p1-b1',
  kind: 'paragraph',
  text: 'synthetic',
  box: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 },
  continues: null,
}

function response(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage,
    warnings: [],
  }
}

test('OCR preserves page order and bounds model concurrency at two', async () => {
  let active = 0
  let maximum = 0
  let call = 0
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      const index = call++
      maximum = Math.max(maximum, ++active)
      await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 1))
      active--
      return response(
        JSON.stringify({ blocks: [{ ...block, id: `p${index + 1}-b1` }] })
      )
    },
  })
  const result = await ocrPages(
    Array.from({ length: 4 }, () => new Uint8Array([1])),
    llmOcr(model)
  )
  assert.equal(maximum, 2)
  assert.deepEqual(
    result.map((page) => page.blocks[0]?.id),
    ['p1-b1', 'p2-b1', 'p3-b1', 'p4-b1']
  )
  assert.equal(model.doGenerateCalls.length, 4)
})

test('OCR rejects invalid structured output without exposing provider text', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: response('{"blocks":[{"text":"PRIVATE SENTINEL"}]}'),
  })
  await assert.rejects(
    ocrPages([new Uint8Array([1])], llmOcr(model)),
    (error) => {
      assert.ok(error instanceof Error)
      assert.equal(error.name, 'OcrError')
      assert.ok(!error.message.includes('PRIVATE SENTINEL'))
      return true
    }
  )
})

test('OCR rejects out-of-page boxes and duplicate IDs', async () => {
  for (const blocks of [
    [{ ...block, box: { ...block.box, x: 0.9 } }],
    [block, block],
  ]) {
    const model = new MockLanguageModelV4({
      doGenerate: response(JSON.stringify({ blocks })),
    })
    await assert.rejects(ocrPages([new Uint8Array([1])], llmOcr(model)), {
      name: 'OcrError',
    })
  }
})

test('LLM OCR reports latency and token usage without word boxes', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: response(JSON.stringify({ blocks: [block] })),
  })
  const [page] = await ocrPages([new Uint8Array([1])], llmOcr(model))

  assert.equal(page?.words, undefined)
  assert.deepEqual(page?.usage.tokens, { input: 1, cachedInput: 0, output: 1 })
  assert.ok((page?.usage.latencyMs ?? -1) >= 0)
})

test('OCR accepts provider word boxes and rejects out-of-page words', async () => {
  const word = { text: 'synthetic', box: block.box, confidence: 0.9 }
  const provider = (box: typeof block.box) => async () => ({
    blocks: [{ ...block, kind: 'paragraph' as const }],
    words: [{ ...word, box }],
    usage: { latencyMs: 1 },
  })

  const [page] = await ocrPages([new Uint8Array([1])], provider(word.box))
  assert.deepEqual(page?.words, [word])

  await assert.rejects(
    ocrPages([new Uint8Array([1])], provider({ ...word.box, y: 0.95 })),
    { name: 'OcrError' }
  )
})
