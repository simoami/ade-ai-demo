'use client'

import { Button } from '@repo/ui/components/button'
import { Activity, Download, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useId, useRef } from 'react'
import { AppNav } from '#components/app-nav'
import { DemoAdmin } from '#components/demo-admin'
import { ThemeToggle } from '#components/theme-toggle'
import type { DocumentSummary } from '#lib/records-types'
import { sampleDocuments } from '#lib/sample-documents'

/** Shared brand, navigation, breadcrumbs and appearance control. */
export function WorkspaceShell({
  children,
  documents,
}: {
  children: React.ReactNode
  documents: DocumentSummary[]
}) {
  const samplesId = useId()
  const samplesTitleId = useId()
  const samplesRef = useRef<HTMLElement>(null)
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
        <section
          ref={samplesRef}
          id={samplesId}
          aria-labelledby={samplesTitleId}
          className="mt-6 overflow-y-auto rounded-lg border bg-card p-3 text-[11px]"
        >
          <h2 id={samplesTitleId} className="text-xs font-semibold">
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
          <div className="flex items-center gap-1">
            <DemoAdmin
              samplesId={samplesId}
              onBrowseSamples={() => {
                const card = samplesRef.current
                if (!card) return

                card.scrollIntoView({ block: 'nearest' })
                card.animate(
                  [
                    { boxShadow: '0 0 0 3px var(--primary)' },
                    { boxShadow: '0 0 0 3px transparent' },
                  ],
                  { duration: 1500, easing: 'ease-out' }
                )
              }}
            />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
