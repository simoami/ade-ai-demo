'use client'

import { cn } from '@repo/ui/lib/utils'
import { FileText, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/patients', label: 'Patients', icon: UsersRound },
]

/** Workspace sidebar navigation with the current section highlighted. */
export function AppNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
            pathname.startsWith(href) &&
              'bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
