import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

/** Confirms discarding a document, which cannot be reviewed afterwards. */
export function DiscardDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard this document?</DialogTitle>
          <DialogDescription>
            A discarded document contributes no observations and cannot be
            reviewed again. Use this for duplicates or the wrong patient.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" onClick={onDiscard}>
            Discard document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
