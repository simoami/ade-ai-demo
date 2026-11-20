import { z } from 'zod'

const origin = z.url().refine((value) => {
  const url = new URL(value)
  return (
    ['http:', 'https:'].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === '/' &&
    (url.protocol === 'https:' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
})

/** Validates the fixed service origin and required gateway credentials. */
export function validateEnvironment(env: Record<string, string | undefined>) {
  const schema = z.object({
    PIPELINE_SERVICE_ORIGIN: origin,
    PIPELINE_SERVICE_SECRET:
      env.VERCEL === '1' ? z.string().optional() : z.string().trim().min(32),
  })
  // A Vercel deployment serves the eve service itself, so it defaults to its own URL.
  const parsed = schema.safeParse({
    ...env,
    PIPELINE_SERVICE_ORIGIN:
      env.PIPELINE_SERVICE_ORIGIN ??
      (env.VERCEL === '1' && env.VERCEL_URL
        ? `https://${env.VERCEL_URL}`
        : undefined),
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${[...new Set(parsed.error.issues.map((issue) => issue.path[0]))].join(', ')}`
    )
  }

  return { ...parsed.data, vercel: env.VERCEL === '1' }
}
