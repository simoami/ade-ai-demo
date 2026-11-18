import { withEve } from 'eve/next'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = { transpilePackages: ['@repo/ui', '@repo/ai'] }

export default withEve(nextConfig, { eveRoot: '../../packages/ai' })
