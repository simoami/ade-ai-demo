import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/** Back button to the patient list with the page's location. */
export function PatientBackLink() {
  return (
    <div className="mb-[21px] flex items-center gap-2.5 text-[10px] text-muted-foreground">
      <Link
        href="/patients"
        className="grid size-8 shrink-0 place-items-center rounded-md border bg-card p-0 text-muted-foreground"
        aria-label="Back to patients"
      >
        <ArrowLeft size={16} />
      </Link>
      <span>Patients / Patient profile</span>
    </div>
  )
}
