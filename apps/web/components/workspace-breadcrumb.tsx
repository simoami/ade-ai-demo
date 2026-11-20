'use client'

import { Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DocumentSummary } from '#lib/records-types'

/** Resolves the current breadcrumb from the live document names. */
export function WorkspaceBreadcrumb({
  documents,
}: {
  documents: DocumentSummary[]
}) {
  const pathname = usePathname()
  const section = pathname.startsWith('/patients') ? 'Patients' : 'Documents'
  const id = pathname.split('/')[2]
  const current =
    documents.find((document) => document.id === id)?.fileName ?? id
  return (
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
  )
}
