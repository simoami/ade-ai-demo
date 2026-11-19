import type { OcrUsage } from '#stages/ocr/ocr-result'

/**
 * Standard short-context USD per million tokens (OCR pages stay far below the 272K-token
 * long-context threshold). Checked 2026-11-18 at https://developers.openai.com/api/docs/pricing.
 */
const ocrPrices: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  'gpt-6.1-sol': { input: 2, cachedInput: 0.1, output: 10 },
  'gpt-6-luna': { input: 0.1, cachedInput: 0.01, output: 0.5 },
}

/** USD for one page: the vendor-reported cost, or a token estimate where input counts include cached tokens. */
export function ocrPageCost(provider: string, usage: OcrUsage) {
  if (usage.costUsd !== undefined) return usage.costUsd

  const price = ocrPrices[provider]
  if (!price || !usage.tokens) throw new Error(`No OCR price for ${provider}`)

  const { input, cachedInput, output } = usage.tokens
  return (
    ((input - cachedInput) * price.input +
      cachedInput * price.cachedInput +
      output * price.output) /
    1_000_000
  )
}
