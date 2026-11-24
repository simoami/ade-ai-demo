import { deleteDocumentsResultSchema } from '@repo/ai/review-action'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { DeleteAllDialog } from './delete-all-dialog.tsx'

/** Workspace reset: deletes every document after confirmation and reports the count. */
export function AdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const deleteTitleId = useId()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function handleRequestDelete() {
    setError('')
    setConfirmOpen(true)
  }

  async function handleDeleteAll() {
    setDeleting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/documents', { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete request failed')
      const result = deleteDocumentsResultSchema.parse(await response.json())
      setMessage(
        `Deleted ${result.deleted} document${result.deleted === 1 ? '' : 's'}.`
      )
      setConfirmOpen(false)
      router.replace('/documents')
      router.refresh()
    } catch {
      setError(
        'Unable to delete all documents. Some cleanup may have completed. Try again.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Admin</DialogTitle>
          <DialogDescription>Reset the workspace.</DialogDescription>
        </DialogHeader>
        <section className="space-y-3" aria-labelledby={deleteTitleId}>
          <h2 id={deleteTitleId} className="font-semibold">
            Delete all documents
          </h2>
          <p className="text-muted-foreground">
            Remove uploaded documents and their derived data. Patients stay.
          </p>
          <Button variant="destructive" onClick={handleRequestDelete}>
            Delete all documents
          </Button>
          {message.length > 0 && <p role="status">{message}</p>}
        </section>
        <DeleteAllDialog
          open={confirmOpen}
          deleting={deleting}
          error={error}
          onOpenChange={setConfirmOpen}
          onConfirm={handleDeleteAll}
        />
      </DialogContent>
    </Dialog>
  )
}
