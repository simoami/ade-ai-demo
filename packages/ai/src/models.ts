import { openai } from '@ai-sdk/openai'
import type { EmbeddingModel, LanguageModel } from 'ai'

export const models = {
  pipeline: openai('gpt-6.1-sol'),
  fast: openai('gpt-6-luna'),
} satisfies Record<string, LanguageModel>

export const embeddingModel: EmbeddingModel = openai.embedding(
  'text-embedding-3-small'
)
