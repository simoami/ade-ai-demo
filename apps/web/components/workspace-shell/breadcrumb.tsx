import { WorkspaceBreadcrumb } from '#components/workspace-breadcrumb'
import { getDocuments } from '#lib/server/records'

/** Workspace breadcrumb resolved against current document names. */
export async function Breadcrumb() {
  return <WorkspaceBreadcrumb documents={await getDocuments()} />
}
