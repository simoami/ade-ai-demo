import { Button } from '@repo/ui/components/button'
import { Activity, Download } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Suspense, useId } from 'react'
import { AppNav } from '#components/app-nav'
import { ChatDrawer } from '#components/chat/chat-drawer'
import { DemoAdmin } from '#components/demo-admin'
import { ThemeToggle } from '#components/theme-toggle'
import { WorkspaceBreadcrumb } from '#components/workspace-breadcrumb'
import { sampleDocuments } from '#lib/sample-documents'
import { getDocuments } from '#lib/server/records'

/** Shared brand, navigation, breadcrumbs and appearance control. */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const samplesId = useId()
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="sticky top-0 flex h-svh w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3.5 pt-[22px] pb-3 max-md:w-44">
        <Link
          href="/documents"
          className="flex h-[33px] items-center gap-2 px-2 text-[17px] font-bold tracking-[-.6px]"
        >
          <span className="grid size-[25px] place-items-center rounded-[7px] bg-primary text-primary-foreground">
            <Activity size={17} strokeWidth={2.5} />
          </span>
          <span>
            ade
            <span className="font-medium text-muted-foreground">.health</span>
          </span>
        </Link>
        <div className="mx-2 mt-[33px] mb-2.5 text-[10px] font-bold tracking-widest text-muted-foreground">
          WORKSPACE
        </div>
        <Suspense
          fallback={
            <nav aria-label="Main" className="flex flex-col gap-1">
              {['Documents', 'Patients'].map((label) => (
                <Link
                  key={label}
                  href={`/${label.toLowerCase()}`}
                  className="flex h-[37px] items-center gap-2.5 rounded-md px-2.5 text-xs text-sidebar-foreground"
                >
                  {label}
                </Link>
              ))}
            </nav>
          }
        >
          <AppNav
            reviewCount={
              <Suspense fallback="…">
                <ReviewCount />
              </Suspense>
            }
          />
        </Suspense>
        <SampleCard samplesId={samplesId} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-[54px] items-center justify-between border-b bg-card px-8">
          <Suspense
            fallback={
              <span className="text-xs text-muted-foreground">Workspace</span>
            }
          >
            <Breadcrumb />
          </Suspense>
          <div className="flex items-center gap-1">
            <DemoAdmin samplesId={samplesId} />
            <Suspense fallback={null}>
              <ChatDrawer />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

async function ReviewCount() {
  return (await getDocuments()).filter(
    (document) => document.status === 'needsReview'
  ).length
}

async function Breadcrumb() {
  return <WorkspaceBreadcrumb documents={await getDocuments()} />
}

async function SampleCard({ samplesId }: { samplesId: string }) {
  'use cache'
  cacheLife('max')
  cacheTag('samples')
  return (
    <section
      id={samplesId}
      aria-labelledby={`${samplesId}-title`}
      className="mt-6 overflow-y-auto rounded-lg border bg-card p-3 text-[11px]"
    >
      <h2 id={`${samplesId}-title`} className="text-xs font-semibold">
        Sample documents
      </h2>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Download one, then upload it to see the pipeline
      </p>
      <ul className="mt-2 divide-y">
        {sampleDocuments.map((sample) => (
          <li key={sample.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{sample.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {sample.pages} {sample.pages === 1 ? 'page' : 'pages'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <a
                  href={`/sample-documents/${sample.id}.pdf`}
                  download={sample.downloadName}
                  aria-label={`Download ${sample.name}`}
                />
              }
            >
              <Download className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
