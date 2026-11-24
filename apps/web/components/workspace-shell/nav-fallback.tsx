import Link from 'next/link'

/** Plain navigation links shown until the live navigation streams in. */
export function NavFallback() {
  return (
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
  )
}
