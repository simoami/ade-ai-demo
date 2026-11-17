import { z } from "zod"

const credentials = z
  .object({
    AI_GATEWAY_API_KEY: z.string().trim().min(1).optional(),
    VERCEL_OIDC_TOKEN: z.string().trim().min(1).optional(),
  })
  .refine((env) => env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN)

export function validateEnvironment(env: NodeJS.ProcessEnv): void {
  if (!credentials.safeParse(env).success) {
    throw new Error(
      "Set AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN to a non-empty credential before starting the agent."
    )
  }
}
