import { redirect } from 'next/navigation'

/** Opens the workspace on the document list. */
export default function Page() {
  redirect('/documents')
}
