import { WorkspaceShell } from '#components/workspace-shell'
import { getDocuments } from '#lib/server/records'

/** Provides the shared workspace navigation and breadcrumb bar. */
export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceShell documents={await getDocuments()}>{children}</WorkspaceShell>
  )
}
