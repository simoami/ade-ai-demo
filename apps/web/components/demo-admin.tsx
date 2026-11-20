'use client'

import { deleteDocumentsResultSchema } from '@repo/ai/review-action'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useState, useSyncExternalStore } from 'react'
import { PipelineStages } from '#components/pipeline-stages'
import { dismissWelcome, shouldShowWelcome } from '#lib/welcome'

const subscribe = () => () => {}

/** Workspace administration controls and a browser-only welcome preference. */
export function DemoAdmin({ samplesId }: { samplesId: string }) {
  const router = useRouter()
  const [adminOpen, setAdminOpen] = useState(false)
  const [welcomeClosed, setWelcomeClosed] = useState(false)
  const welcomeEnabled = useSyncExternalStore(
    subscribe,
    () => shouldShowWelcome(() => window.localStorage),
    () => false
  )
  const welcomeOpen = welcomeEnabled && !welcomeClosed
  const deleteTitleId = useId()
  const [showAgain, setShowAgain] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function closeWelcome() {
    dismissWelcome(() => window.localStorage, showAgain)
    setWelcomeClosed(true)
  }

  async function deleteAll() {
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
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label="Admin"
              onClick={() => setAdminOpen(true)}
            />
          }
        >
          <Settings className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="left">Admin</TooltipContent>
      </Tooltip>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
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
            <Button
              variant="destructive"
              onClick={() => {
                setError('')
                setConfirmOpen(true)
              }}
            >
              Delete all documents
            </Button>
            {message.length > 0 && <p role="status">{message}</p>}
          </section>
          <Dialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (!deleting) setConfirmOpen(open)
            }}
          >
            <DialogContent showCloseButton={!deleting}>
              <DialogHeader>
                <DialogTitle>Delete all documents?</DialogTitle>
                <DialogDescription>
                  This removes every document, its pages, redactions,
                  observations and review history. Patients stay.
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
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={deleteAll}
                >
                  {deleting ? 'Deleting…' : 'Delete all documents'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      <Dialog
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (!open) closeWelcome()
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Try the document pipeline</DialogTitle>
          </DialogHeader>
          <PipelineStages />
          <DialogDescription>
            Download a{' '}
            <a
              href={`#${samplesId}`}
              className="rounded-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
              onClick={(event) => {
                event.preventDefault()
                closeWelcome()
                const card = document.getElementById(samplesId)
                if (!card) return

                card.scrollIntoView({ block: 'nearest' })
                card.animate(
                  [
                    { boxShadow: '0 0 0 3px var(--primary)' },
                    { boxShadow: '0 0 0 3px transparent' },
                  ],
                  { duration: 1500, easing: 'ease-out' }
                )
              }}
            >
              sample document
            </a>{' '}
            and upload it to see the extraction pipeline in action.
          </DialogDescription>
          <DialogFooter>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showAgain}
                onChange={(event) => setShowAgain(event.target.checked)}
                className="size-4 accent-primary"
              />
              Show this again
            </label>
            <Button className="ms-auto" onClick={closeWelcome}>
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
