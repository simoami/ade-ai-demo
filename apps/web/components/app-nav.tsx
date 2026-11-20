'use client'

import { cn } from '@repo/ui/lib/utils'
import { Inbox, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { documents } from '#lib/sample-records'

const links = [
  { href: '/documents', label: 'Documents', icon: Inbox },
  { href: '/patients', label: 'Patients', icon: UsersRound },
]

/** Workspace sticky top-0 flex h-svh w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3.5 pt-[22px] pb-3 max-md:w-44 navigation with the current section highlighted. */
export function AppNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex h-[37px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs text-sidebar-foreground hover:bg-sidebar-accent',
            pathname.startsWith(href) &&
              'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
          )}
        >
          <Icon className="size-4" />
          {label}
          {href === '/documents' && (
            <span className="ml-auto text-[11px] font-semibold text-primary">
              {
                documents.filter(
                  (document) => document.status === 'needsReview'
                ).length
              }
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
