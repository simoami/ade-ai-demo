import { Suspense } from 'react'
import { PatientRows } from '#components/patient-rows'
import { PatientsSkeleton } from '#components/record-skeletons/patients-skeleton'

/** Prerenders the patient heading and streams current patient rows. */
export default function PatientsPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="text-sm text-muted-foreground">
          Patients are stored as identifier hashes with initials, sex and birth
          year.
        </p>
      </header>
      <Suspense fallback={<PatientsSkeleton />}>
        <PatientRows />
      </Suspense>
    </main>
  )
}
