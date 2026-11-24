import type { ReactNode } from 'react'

/** Side panel column: a fixed tab bar above the scrolling active tab. */
export function ReviewSidePanel({
  tabs,
  children,
}: {
  tabs: ReactNode
  children: ReactNode
}) {
  return (
    <aside className="flex min-h-0 flex-col border-l bg-card">
      {tabs}
      <div className="min-h-0 flex-1 overflow-auto px-[15px] py-4">
        {children}
      </div>
    </aside>
  )
}
