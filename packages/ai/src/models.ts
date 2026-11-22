import { openai } from '@ai-sdk/openai'
import type { EmbeddingModel, LanguageModel } from 'ai'

/** Direct OpenAI language models used by the pipeline and agent. */
export const models = {
  pipeline: openai('gpt-6.1-sol'),
  chat: openai('gpt-6.1-sol'),
  fast: openai('gpt-6-luna'),
} satisfies Record<string, LanguageModel>

/** Direct OpenAI model for note embeddings. */
export const embeddingModel: EmbeddingModel = openai.embedding(
  'text-embedding-3-small'
)
