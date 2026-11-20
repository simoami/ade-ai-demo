'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Refreshes server data while documents are processing, cleaning up when processing ends. */
export function ProcessingRefresh({
  active,
  path,
}: {
  active: boolean
  path: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!active || pathname !== path) return

    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [active, pathname, path, router])

  return null
}
