import { httpBasic, routeAuth, vercelOidc } from 'eve/channels/auth'
import { validateEnvironment } from '#agent/lib/environment'

/** Requires local Basic authentication or deployment OIDC before document access. */
export async function authenticatePipeline(
  request: Request,
  env = process.env
) {
  const settings = validateEnvironment(env)
  const auth =
    env.VERCEL === '1'
      ? vercelOidc({
          currentVercelProject: {
            projectId: settings.VERCEL_PROJECT_ID ?? '',
            environment: env.VERCEL_TARGET_ENV ?? env.VERCEL_ENV,
          },
        })
      : httpBasic({
          username: 'pipeline',
          password: settings.PIPELINE_SERVICE_SECRET ?? '',
        })

  return routeAuth(request, auth)
}
