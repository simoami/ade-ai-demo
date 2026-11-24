import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import {
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/components/drawer'
import { X } from 'lucide-react'

/** Assistant title, verification note, page scope and close button. */
export function ChatDrawerHeader({ scopeLabel }: { scopeLabel: string }) {
  return (
    <DrawerHeader className="flex-row items-start justify-between border-b">
      <div>
        <DrawerTitle>Clinical assistant</DrawerTitle>
        <DrawerDescription>
          Answers from redacted records. Verify unreviewed values.
        </DrawerDescription>
        <Badge
          variant="secondary"
          className="mt-2 max-w-full whitespace-normal break-all"
        >
          {scopeLabel}
        </Badge>
      </div>
      <DrawerClose
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Close assistant" />
        }
      >
        <X />
      </DrawerClose>
    </DrawerHeader>
  )
}
