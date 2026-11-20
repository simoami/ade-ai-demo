import { withEve } from 'eve/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@repo/ui', '@repo/ai', '@repo/logger'],
}

/** Connects the Next.js application to the eve service. */
export default process.env.VERCEL === '1'
  ? nextConfig
  : withEve(nextConfig, { eveRoot: '../../packages/ai' })
