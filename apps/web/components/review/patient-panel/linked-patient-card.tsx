import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Card } from '@repo/ui/components/card'
import type { FieldMatch, MatchField, Patient } from '#lib/records-types'
import { matchStrength } from '#lib/review'
import { FieldResult } from './field-result.tsx'
import { StrengthBadge } from './strength-badge.tsx'

const fieldLabels = {
  lastName: 'Last name',
  firstName: 'First name',
  birthDate: 'Date of birth',
  mrn: 'MRN',
  sex: 'Sex',
} as const satisfies Record<MatchField, string>

/** The linked patient with the overall match strength and each identifier's comparison. */
export function LinkedPatientCard({
  patient,
  fields,
}: {
  patient: Patient
  fields: Record<MatchField, FieldMatch>
}) {
  return (
    <Card className="p-[13px]">
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
    </Card>
  )
}
