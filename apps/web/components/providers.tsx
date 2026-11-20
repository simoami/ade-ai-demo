'use client'

import { TooltipProvider } from '@repo/ui/components/tooltip'
import { ThemeProvider } from 'next-themes'

/** Provides persistent system-aware appearance and shared tooltip timing. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delay={100}>{children}</TooltipProvider>
    </ThemeProvider>
  )
}
