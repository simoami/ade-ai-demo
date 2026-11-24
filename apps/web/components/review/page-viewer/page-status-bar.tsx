import { Lock } from 'lucide-react'

/** Footer noting the page is read only and its position. */
export function PageStatusBar({
  page,
  pageCount,
}: {
  page: number
  pageCount: number
}) {
  return (
    <div className="flex h-[29px] shrink-0 items-center justify-between border-t bg-card/50 px-3 text-[8.5px] text-muted-foreground [&_span]:flex [&_span]:items-center [&_span]:gap-1">
      <span>
        <Lock size={13} />
        Read only
      </span>
      <span>
        Page {page} of {pageCount}
      </span>
    </div>
  )
}
