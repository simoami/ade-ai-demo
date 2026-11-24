import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Card } from '@repo/ui/components/card'
import Link from 'next/link'
import { getPatients } from '#lib/server/records'

/** Patient list: stored demographics and linked document counts. */
export async function PatientRows() {
  const patients = await getPatients()

  return (
    <>
      {patients.length === 0 && (
        <Card render={<p />} className="p-6 text-sm text-muted-foreground">
          No patients yet. Patients appear once documents have been linked.
        </Card>
      )}
      <Card render={<ul />} className="flex flex-col divide-y">
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
      </Card>
    </>
  )
}
