import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'

/** Avatar and label for the patient the document is being reviewed for. */
export function ReviewingFor({
  initials,
  label,
}: {
  initials: string
  label: string
}) {
  return (
    <div className="flex items-center gap-2 [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_strong]:text-[9px] [&_div>span]:text-[8px] [&_div>span]:text-muted-foreground">
      <Avatar className="size-[29px]">
        <AvatarFallback className="bg-accent text-[9px] font-bold text-accent-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div>
        <span>Reviewing for</span>
        <strong>{label}</strong>
      </div>
    </div>
  )
}
