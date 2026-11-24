import { Alert, AlertDescription } from '@repo/ui/components/alert'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import { Info } from 'lucide-react'
import { type MouseEvent, useState, useSyncExternalStore } from 'react'
import { PipelineStages } from '#components/pipeline-stages'
import { dismissWelcome, shouldShowWelcome } from '#lib/welcome'

const subscribe = () => () => {}

/** First-visit pipeline overview pointing at the sample documents, with a browser-only "show again" preference. */
export function WelcomeDialog({ samplesId }: { samplesId: string }) {
  const [welcomeClosed, setWelcomeClosed] = useState(false)
  const welcomeEnabled = useSyncExternalStore(
    subscribe,
    () => shouldShowWelcome(() => window.localStorage),
    () => false
  )
  const welcomeOpen = welcomeEnabled && !welcomeClosed
  const [showAgain, setShowAgain] = useState(true)

  function handleCloseWelcome() {
    dismissWelcome(() => window.localStorage, showAgain)
    setWelcomeClosed(true)
  }

  function handleShowSamples(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    handleCloseWelcome()
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
  }

  return (
    <Dialog
      open={welcomeOpen}
      onOpenChange={(open) => {
        if (!open) handleCloseWelcome()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Try the document pipeline</DialogTitle>
        </DialogHeader>
        <PipelineStages />
        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            <DialogDescription>
              Download a{' '}
              <a
                href={`#${samplesId}`}
                className="rounded-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
                onClick={handleShowSamples}
              >
                sample document
              </a>{' '}
              and upload it to see the extraction pipeline in action.
            </DialogDescription>
          </AlertDescription>
        </Alert>
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
          <Button className="ms-auto" onClick={handleCloseWelcome}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
