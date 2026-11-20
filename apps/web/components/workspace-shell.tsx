'use client'

import { Activity, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppNav } from '#components/app-nav'
import { ThemeToggle } from '#components/theme-toggle'
import type { DocumentSummary } from '#lib/records-types'

/** Shared brand, navigation, breadcrumbs and appearance control. */
export function WorkspaceShell({
  children,
  documents,
}: {
  children: React.ReactNode
  documents: DocumentSummary[]
}) {
  const pathname = usePathname()
  const section = pathname.startsWith('/patients') ? 'Patients' : 'Documents'
  const id = pathname.split('/')[2]
  const current =
    documents.find((document) => document.id === id)?.fileName ?? id

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
        <AppNav documents={documents} />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-[54px] items-center justify-between border-b bg-card px-8">
          <nav
            className="flex items-center gap-3 text-[11px] text-muted-foreground"
            aria-label="Breadcrumb"
          >
            <Link
              href="/documents"
              className="grid place-items-center p-1"
              aria-label="Home"
            >
              <Home size={15} />
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <Link href={section === 'Patients' ? '/patients' : '/documents'}>
              {section}
            </Link>
            {current !== undefined && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-semibold text-foreground">{current}</span>
              </>
            )}
          </nav>
          <ThemeToggle />
        </header>
        {children}
      </div>
    </div>
  )
}
