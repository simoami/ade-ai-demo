import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

/** Confirms deleting every document; it cannot be closed while the deletion runs. */
export function DeleteAllDialog({
  open,
  deleting,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  deleting: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={!deleting}>
        <DialogHeader>
          <DialogTitle>Delete all documents?</DialogTitle>
          <DialogDescription>
            This removes every document, its pages, redactions, observations and
            review history. Patients stay.
          </DialogDescription>
        </DialogHeader>
        {error.length > 0 && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={onConfirm}>
            {deleting ? 'Deleting…' : 'Delete all documents'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
