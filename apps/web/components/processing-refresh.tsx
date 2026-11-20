'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Refreshes server data while documents are processing, cleaning up when processing ends. */
export function ProcessingRefresh({ active }: { active: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return

    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [active, router])

  return null
}
