import { Button } from '@repo/ui/components/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Previous and next page buttons around the page position. */
export function PageNavigation({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <span className="w-16 text-center tabular-nums">
        {page} of {pageCount}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next page"
        disabled={page === pageCount}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight />
      </Button>
    </>
  )
}
