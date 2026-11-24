import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Card } from '@repo/ui/components/card'
import type { ProposedPatient } from '#lib/records-types'

/** The patient that will be created from the document's demographics. */
export function ProposedPatientCard({ patient }: { patient: ProposedPatient }) {
  return (
    <Card className="flex items-center gap-2 p-[13px]">
      <Avatar>
        <AvatarFallback className="bg-accent text-[10px] font-semibold text-accent-foreground">
          {patient.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">New patient</span>
        <span className="text-xs text-muted-foreground">
          {patient.sex} · born {patient.birthYear ?? 'Unknown'}
        </span>
      </div>
    </Card>
  )
}
