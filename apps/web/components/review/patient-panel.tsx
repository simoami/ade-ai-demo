import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/command'
import { cn } from '@repo/ui/lib/utils'
import { Check, Minus, UserPlus, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import type {
  FieldMatch,
  MatchField,
  Patient,
  ReviewDocument,
} from '#lib/records-types'
import { type MatchStrength, matchStrength } from '#lib/review'

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

  return (
    <div className="flex flex-col gap-3">
      {patient && fields ? (
        <div className="rounded-lg border bg-card p-[13px]">
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback className="bg-accent text-[80%] font-semibold text-accent-foreground">
                {patient.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{patient.id}</span>
              <span className="text-xs text-muted-foreground">
                {patient.sex} · born {patient.birthYear ?? 'Unknown'}
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
      ) : creating && document.proposedPatient ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-[13px]">
          <Avatar>
            <AvatarFallback className="bg-accent text-[10px] font-semibold text-accent-foreground">
              {document.proposedPatient.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">New patient</span>
            <span className="text-xs text-muted-foreground">
              {document.proposedPatient.sex} · born{' '}
              {document.proposedPatient.birthYear ?? 'Unknown'}
            </span>
          </div>
        </div>
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

      <CommandDialog
        open={picking}
        onOpenChange={setPicking}
        title="Change patient"
        description="Choose the patient this document belongs to."
      >
        <Command>
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
                    onLink(candidate.id)
                    setPicking(false)
                  }}
                >
                  <div className="w-full flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-accent text-[80%] font-semibold text-accent-foreground">
                        {candidate.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{candidate.id}</span>
                    <span className="text-muted-foreground">
                      {candidate.sex} · {candidate.birthYear ?? 'Unknown'}
                    </span>
                  </div>
                  {candidateFields !== undefined && (
                    <StrengthBadge strength={matchStrength(candidateFields)} />
                  )}
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
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
        <Check className="size-4" /> Matched
      </span>
    )

  if (result === 'mismatch')
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <X className="size-4" /> Unmatched
      </span>
    )

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Minus className="size-4" /> Not in document
    </span>
  )
}
