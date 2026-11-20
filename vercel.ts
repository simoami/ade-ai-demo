import { resolve } from 'node:path'
import { withEve } from 'eve/vercel'

const config = await withEve(
  {
    services: {
      web: {
        framework: 'nextjs',
        root: 'apps/web',
        buildCommand: 'pnpm build',
        bindings: [
          {
            type: 'service',
            service: 'eve',
            format: 'url',
            env: 'PIPELINE_SERVICE_ORIGIN',
          },
        ],
      },
    },
    routes: [
      { src: '^(.*)$', destination: { type: 'service', service: 'web' } },
    ],
  },
  // Vercel compiles this file into .vercel/, so resolve from the repository root.
  { root: resolve('packages/ai') }
)

// eve generates service roots relative to its project; Vercel resolves them from this file.
const services = Object.fromEntries(
  Object.entries(config.services).map(([name, service]) => [
    name,
    name === 'eve'
      ? { ...service, root: `packages/ai/${service.root}` }
      : service,
  ])
)

/** Composes the web gateway and its privately bound document service. */
export default { ...config, services }
