import { Skeleton } from '@repo/ui/components/skeleton'
import type { PageImage } from '#lib/records-types'
import { PageThumbnail } from './page-thumbnail.tsx'

/** Page thumbnails with review flags, or placeholders while pages render. */
export function PageRail({
  images,
  pageCount,
  page,
  regions,
  onPage,
}: {
  images: PageImage[]
  pageCount: number
  page: number
  regions: { page: number; state: string }[]
  onPage: (page: number) => void
}) {
  return (
    <nav
      aria-label="Pages"
      className="min-h-0 border-r bg-card/50 px-2.5 py-3 overflow-y-auto"
    >
      {images.map((image, index) => {
        const number = index + 1
        return (
          <PageThumbnail
            key={image.src}
            image={image}
            number={number}
            current={number === page}
            flagged={regions.some(
              (item) => item.page === number && item.state === 'needsReview'
            )}
            onSelect={() => onPage(number)}
          />
        )
      })}
      {images.length === 0 &&
        Array.from({ length: pageCount || 1 }, (_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: Placeholders stand in for page numbers.
            key={index}
            className="mx-auto mt-1 mb-5 aspect-[8.5/11] w-[57px] rounded-sm"
          />
        ))}
    </nav>
  )
}
