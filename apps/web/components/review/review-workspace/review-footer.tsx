import type { ReactNode } from 'react'

/** Fixed bar under the review columns for the patient, status and finishing actions. */
export function ReviewFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="flex h-[62px] shrink-0 items-center justify-between gap-3 border-t bg-card px-[22px]">
      {children}
    </footer>
  )
}
