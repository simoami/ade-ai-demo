import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/command'
import type { Patient, ReviewDocument } from '#lib/records-types'
import { matchStrength } from '#lib/review'
import { StrengthBadge } from './strength-badge.tsx'

/** Searchable dialog listing every patient with its match strength against the document. */
export function PatientPicker({
  open,
  onOpenChange,
  patients,
  patientMatches,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patients: Patient[]
  patientMatches: ReviewDocument['patientMatches']
  onSelect: (patientId: string) => void
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change patient"
      description="Choose the patient this document belongs to."
    >
      <Command>
        <CommandInput placeholder="Search by patient ID or initials" />
        <CommandList>
          <CommandEmpty>No patients found.</CommandEmpty>
          {patients.map((candidate) => {
            const candidateFields = patientMatches[candidate.id]
            return (
              <CommandItem
                key={candidate.id}
                value={`${candidate.id} ${candidate.initials}`}
                onSelect={() => onSelect(candidate.id)}
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
  )
}
