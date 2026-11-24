import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { Settings } from 'lucide-react'

/** Settings icon button that opens the admin dialog. */
export function AdminButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label="Admin"
            onClick={onClick}
          />
        }
      >
        <Settings className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="left">Admin</TooltipContent>
    </Tooltip>
  )
}
