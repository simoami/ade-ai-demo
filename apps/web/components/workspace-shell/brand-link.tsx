import { Activity } from 'lucide-react'
import Link from 'next/link'

/** Product mark linking to the documents list. */
export function BrandLink() {
  return (
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
  )
}
