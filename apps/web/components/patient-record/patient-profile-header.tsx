import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import type { Patient } from '#lib/records-types'

/** Patient initials, ID and stored demographics. */
export function PatientProfileHeader({ patient }: { patient: Patient }) {
  return (
    <header className="flex items-center gap-[15px] border-b pb-[21px] [&_h1]:mt-1 [&_h1]:mb-2 [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:tracking-tight">
      <Avatar className="size-[55px]">
        <AvatarFallback className="bg-accent text-base font-semibold text-accent-foreground">
          {patient.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
          PATIENT PROFILE
        </div>
        <h1>{patient.id}</h1>
        <p className="text-[10px] text-muted-foreground">
          {patient.sex} · born {patient.birthYear ?? 'Unknown'}
        </p>
      </div>
    </header>
  )
}
