import { withEve } from 'eve/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/ui', '@repo/ai', '@repo/logger'],
}

/** Connects the Next.js application to the eve service. */
export default withEve(nextConfig, { eveRoot: '../../packages/ai' })
