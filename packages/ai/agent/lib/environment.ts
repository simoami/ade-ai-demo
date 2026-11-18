import { z } from 'zod'

export function validateEnvironment(env: NodeJS.ProcessEnv) {
  const schema = z.object({
    OPENAI_API_KEY: z.string().trim().min(1),
    PIPELINE_SERVICE_SECRET:
      env.VERCEL === '1' ? z.string().optional() : z.string().trim().min(32),
    VERCEL_PROJECT_ID:
      env.VERCEL === '1' ? z.string().trim().min(1) : z.string().optional(),
  })
  const parsed = schema.safeParse(env)

  if (!parsed.success) {
    throw new Error(
      `Invalid agent environment: ${[...new Set(parsed.error.issues.map((issue) => issue.path[0]))].join(', ')}`
    )
  }

  return parsed.data
}
