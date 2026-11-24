import { Suspense } from 'react'
import { CurrentDocumentStats } from '#components/current-document-stats'
import { RecentDocuments } from '#components/recent-documents'
import { StatsSkeleton } from '#components/record-skeletons/stats-skeleton'
import { TableSkeleton } from '#components/record-skeletons/table-skeleton'
import { UploadZone } from '#components/upload-zone'

/** Document operations with a prerendered upload entry point. */
export default function DocumentsPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-[34px] pt-[29px] pb-12 max-lg:px-[22px]">
      <header className="mb-[23px] flex items-end justify-between [&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-[25px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_p]:text-xs [&_p]:text-muted-foreground">
        <div>
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            <span className="mr-1.5 mb-px inline-block size-1.5 rounded-full bg-primary" />
            DOCUMENT OPERATIONS
          </div>
          <h1>Documents</h1>
          <p>Review, redact, and organize incoming clinical records.</p>
        </div>
      </header>

      <Suspense fallback={<StatsSkeleton />}>
        <CurrentDocumentStats />
      </Suspense>
      <UploadZone />
      <Suspense fallback={<TableSkeleton />}>
        <RecentDocuments />
      </Suspense>
    </main>
  )
}
