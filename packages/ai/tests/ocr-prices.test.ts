import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ocrPageCost } from '#evals/prices'

test('page cost bills cached input at the cached rate', () => {
  const cost = ocrPageCost('gpt-6.1-sol', {
    latencyMs: 1,
    tokens: { input: 1_000_000, cachedInput: 500_000, output: 100_000 },
  })
  assert.ok(Math.abs(cost - (1 + 0.05 + 1)) < 1e-9)
})

test('page cost rejects providers without a documented price', () => {
  assert.throws(() => ocrPageCost('unknown', { latencyMs: 1 }), /No OCR price/)
})
