import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/command'
import { cn } from '@repo/ui/lib/utils'
import { Check, Minus, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import { type MatchStrength, matchStrength } from '#lib/review'
import type {
  FieldMatch,
  MatchField,
  Patient,
  ReviewDocument,
} from '#lib/sample-records'

const fieldLabels: Record<MatchField, string> = {
  lastName: 'Last name',
  firstName: 'First name',
  birthDate: 'Date of birth',
  mrn: 'MRN',
  sex: 'Sex',
}

const strengthLabels: Record<MatchStrength, string> = {
  strong: 'Strong match',
  partial: 'Identity mismatch',
  none: 'No match',
}

/** Shows the linked patient, how each document identifier compares, and a picker to relink. */
export function PatientPanel({
  document,
  patients,
  patientId,
  readOnly,
  onChange,
}: {
  document: ReviewDocument
  patients: Patient[]
  patientId: string | null
  readOnly: boolean
  onChange: (patientId: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const patient = patients.find((candidate) => candidate.id === patientId)
  const fields = patientId ? document.patientMatches[patientId] : undefined

  return (
    <div className="flex flex-col gap-4">
      {patient && fields ? (
        <div className="rounded-lg border bg-card p-[13px]">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
              {patient.initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{patient.id}</span>
              <span className="text-xs text-muted-foreground">
                {patient.sex} · born {patient.birthYear}
              </span>
            </div>
            <StrengthBadge strength={matchStrength(fields)} />
          </div>
          <ul className="mt-4 flex flex-col gap-3 border-t pt-3.5 [&_li>span]:text-[10px] [&_svg]:size-3">
            {(Object.keys(fieldLabels) as MatchField[]).map((field) => (
              <li key={field} className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {fieldLabels[field]}
                </span>
                <FieldResult result={fields[field]} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No patient is linked to this document.
        </p>
      )}

      <p className="rounded-md bg-accent/40 p-2.5 text-[9px] leading-relaxed text-muted-foreground">
        Identifiers read from the document are compared with each patient's
        stored hashes. Names and full dates of birth are not stored.
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

      <CommandDialog
        open={picking}
        onOpenChange={setPicking}
        title="Change patient"
        description="Choose the patient this document belongs to."
      >
        <CommandInput placeholder="Search by patient ID or initials" />
        <CommandList>
          <CommandEmpty>No patients found.</CommandEmpty>
          {patients.map((candidate) => {
            const candidateFields = document.patientMatches[candidate.id]
            return (
              <CommandItem
                key={candidate.id}
                value={`${candidate.id} ${candidate.initials}`}
                onSelect={() => {
                  onChange(candidate.id)
                  setPicking(false)
                }}
              >
                <span className="font-medium">{candidate.id}</span>
                <span className="text-muted-foreground">
                  {candidate.initials} · {candidate.sex} · {candidate.birthYear}
                </span>
                {candidateFields !== undefined && (
                  <span className="ml-auto">
                    <StrengthBadge strength={matchStrength(candidateFields)} />
                  </span>
                )}
              </CommandItem>
            )
          })}
        </CommandList>
      </CommandDialog>
    </div>
  )
}

function StrengthBadge({ strength }: { strength: MatchStrength }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        strength === 'strong' && 'bg-success-muted text-success',
        strength === 'partial' && 'bg-warning-muted text-warning'
      )}
    >
      {strengthLabels[strength]}
    </Badge>
  )
}

function FieldResult({ result }: { result: FieldMatch }) {
  if (result === 'match')
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <Check className="size-4" /> Matches
      </span>
    )

  if (result === 'mismatch')
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <X className="size-4" /> Differs
      </span>
    )

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-4" /> Not in document
    </span>
  )
}
