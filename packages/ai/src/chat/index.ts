import type { InferUITools, UIDataTypes, UIMessage } from 'ai'
import type { chatTools } from './tools.ts'

export { models } from '#models'
export {
  chatInstructions,
  type PageContext,
  pageContextSchema,
} from './context.ts'
export { chatTools, type ObservationView } from './tools.ts'

/** Typed tool outputs shared by the streaming endpoint and in-memory drawer. */
export type ChatMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<ReturnType<typeof chatTools>>
>
