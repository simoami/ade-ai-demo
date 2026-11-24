import { Button } from '@repo/ui/components/button'
import { UserPlus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import type { Patient, ReviewDocument } from '#lib/records-types'
import { LinkedPatientCard } from './patient-panel/linked-patient-card.tsx'
import { PatientPicker } from './patient-panel/patient-picker.tsx'
import { ProposedPatientCard } from './patient-panel/proposed-patient-card.tsx'

/** Shows the linked patient, how each document identifier compares, a picker to relink, and patient creation when none matches. */
export function PatientPanel({
  document,
  patients,
  patientId,
  creating,
  readOnly,
  onLink,
  onCreate,
}: {
  document: ReviewDocument
  patients: Patient[]
  patientId: string | null
  creating: boolean
  readOnly: boolean
  onLink: (patientId: string) => void
  onCreate: () => void
}) {
  const [picking, setPicking] = useState(false)
  const patient = patients.find((candidate) => candidate.id === patientId)
  const fields = patientId ? document.patientMatches[patientId] : undefined

  function handlePick(candidateId: string) {
    onLink(candidateId)
    setPicking(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {patient && fields ? (
        <LinkedPatientCard patient={patient} fields={fields} />
      ) : creating && document.proposedPatient ? (
        <ProposedPatientCard patient={document.proposedPatient} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No patient is linked to this document.
        </p>
      )}

      <p className="rounded-md bg-accent/40 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
        Names, date of birth and MRN are compared using stored hashes. Sex is
        compared directly. Names and full dates of birth are not stored.
      </p>

      {!readOnly && (
        <Button
          className="w-full text-[11px]"
          variant="outline"
          size="lg"
          onClick={() => setPicking(true)}
        >
          <UsersRound data-icon="inline-start" />
          Change patient
        </Button>
      )}

      {!readOnly && !patientId && !creating && document.proposedPatient && (
        <Button
          className="w-full text-[11px]"
          variant="outline"
          size="lg"
          onClick={onCreate}
        >
          <UserPlus data-icon="inline-start" />
          Create patient from document
        </Button>
      )}

      <PatientPicker
        open={picking}
        onOpenChange={setPicking}
        patients={patients}
        patientMatches={document.patientMatches}
        onSelect={handlePick}
      />
    </div>
  )
}
