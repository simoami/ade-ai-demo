import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import Link from 'next/link'
import { Suspense } from 'react'
import { PatientsSkeleton } from '#components/record-skeletons'
import { getPatients } from '#lib/server/records'

/** Patient list: stored demographics and linked document counts. */
async function PatientRows() {
  const patients = await getPatients()

  return (
    <>
      {patients.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No patients yet. Patients appear once documents have been linked.
        </p>
      )}
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {patients.map((patient) => (
          <li key={patient.id}>
            <Link
              href={`/patients/${patient.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <Avatar>
                <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                  {patient.initials}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium">{patient.id}</span>
              <span className="text-sm text-muted-foreground">
                {patient.sex} · born {patient.birthYear ?? 'Unknown'} ·{' '}
                {patient.documentCount} documents
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

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
