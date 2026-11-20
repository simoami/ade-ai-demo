import { ShieldCheck } from 'lucide-react'
import { AppNav } from '#components/app-nav'

/** Workspace shell: sidebar navigation beside the current screen. */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-56 shrink-0 flex-col gap-6 border-r bg-sidebar px-3 py-5 md:flex">
        <div className="flex items-center gap-2 px-2.5 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-3.5" />
          </span>
          Clinical records
        </div>
        <AppNav />
        <p className="mt-auto px-2.5 text-xs text-muted-foreground">
          Synthetic sample data. Every page is shown redacted.
        </p>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
