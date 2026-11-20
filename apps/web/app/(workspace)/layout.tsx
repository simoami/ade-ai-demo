import { WorkspaceShell } from '#components/workspace-shell'

/** Provides the shared workspace navigation and breadcrumb bar. */
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}
