import { Suspense, useId } from 'react'
import { AppNav } from '#components/app-nav'
import { DemoAdmin } from '#components/demo-admin'
import { ThemeToggle } from '#components/theme-toggle'
import { Assistant } from './workspace-shell/assistant.tsx'
import { BrandLink } from './workspace-shell/brand-link.tsx'
import { Breadcrumb } from './workspace-shell/breadcrumb.tsx'
import { NavFallback } from './workspace-shell/nav-fallback.tsx'
import { ReviewCount } from './workspace-shell/review-count.tsx'
import { SampleCard } from './workspace-shell/sample-card.tsx'

/** Shared brand, navigation, breadcrumbs and appearance control. */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const samplesId = useId()
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="sticky top-0 flex h-svh w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3.5 pt-[22px] pb-3 max-md:w-44">
        <BrandLink />
        <div className="mx-2 mt-[33px] mb-2.5 text-[10px] font-bold tracking-widest text-muted-foreground">
          WORKSPACE
        </div>
        <Suspense fallback={<NavFallback />}>
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
              <Assistant />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
