import {
  type ChatMessage,
  chatInstructions,
  chatTools,
  models,
  pageContextSchema,
} from '@repo/ai/chat'
import { logger } from '@repo/logger'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
} from 'ai'
import { z } from 'zod'

/** Maximum duration for one ephemeral assistant response. */
export const maxDuration = 60

const log = logger.getSubLogger({ name: 'chat.route' })

const bodySchema = z.object({
  id: z.string().min(1).max(200),
  messages: z.array(z.unknown()).min(1).max(100),
  context: pageContextSchema,
})

/** Validate a page-scoped conversation and stream only redacted tool-backed answers. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return Response.json({ error: 'Invalid chat request' }, { status: 400 })

  const chatId = crypto.randomUUID()
  const tools = chatTools(parsed.data.context)
  let messages: ChatMessage[]
  try {
    messages = await validateUIMessages<ChatMessage>({
      messages: parsed.data.messages,
      tools,
    })
    if (
      messages.some(
        (message) =>
          message.role === 'system' ||
          message.parts.some((part) => part.type === 'file')
      )
    ) {
      return Response.json({ error: 'Invalid chat request' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Invalid chat request' }, { status: 400 })
  }

  try {
    log.info('Chat started', { chatId, count: messages.length })
    const result = streamText({
      model: models.chat,
      instructions: chatInstructions(parsed.data.context),
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: isStepCount(5),
      abortSignal: request.signal,
      onError: () => {
        log.error('Chat failed', { chatId })
      },
    })

    return createUIMessageStreamResponse({
      headers: { 'Cache-Control': 'no-store' },
      stream: toUIMessageStream<typeof tools, ChatMessage>({
        stream: result.stream,
        tools,
        originalMessages: messages,
        sendReasoning: false,
        redactToolErrors: true,
        onError: () => 'The assistant could not answer. Please try again.',
        onEnd: () => {
          log.info('Chat ended', { chatId })
        },
      }),
    })
  } catch {
    log.error('Chat unavailable', { chatId })
    return Response.json({ error: 'Assistant unavailable' }, { status: 503 })
  }
}
