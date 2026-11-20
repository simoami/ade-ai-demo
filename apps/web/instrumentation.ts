import { registerOTel } from '@vercel/otel'

/** Validates local gateway configuration and registers server telemetry. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.VERCEL !== '1') {
    const { validateEnvironment } = await import('#lib/server/environment')
    validateEnvironment(process.env)
  }
  registerOTel({ serviceName: 'ade-ai-demo' })
}
