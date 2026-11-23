'use client'

import type { ReviewAction } from '@repo/ai/review-action'
import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
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
import { Skeleton } from '@repo/ui/components/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { cn } from '@repo/ui/lib/utils'
import { ArrowLeft, Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ObservationTrend } from '#components/observations/observation-trend'
import { ProcessingRefresh } from '#components/processing-refresh'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import { observationTrends } from '#lib/observations'
import type { Patient, ReviewDocument } from '#lib/records-types'
import { pendingCount, redactionIconKind, reviewMode } from '#lib/review'
import { reviewOutlines } from '#lib/review-outlines'
import {
  canDiscard,
  canMarkReviewed,
  type Decision,
  isLinked,
  isSyncing,
  type LinkOverride,
  type ReviewOverrides,
  submitReview,
  withDecisions,
} from '#lib/review-state'
import { PageViewer } from './page-viewer.tsx'
import { PatientPanel } from './patient-panel.tsx'
import { type ReviewItem, ReviewItems } from './review-items.tsx'

type Tab = 'general' | 'observations'

/** Review screen: page rail, page viewer, and the general (patient and redaction) and observation panels. */
export function ReviewWorkspace({
  document,
  patients,
  initialPage = 1,
  initialTab = 'general',
}: {
  document: ReviewDocument
  patients: Patient[]
  initialPage?: number
  initialTab?: Tab
}) {
  const [page, setPage] = useState(initialPage)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [overrides, setOverrides] = useState<ReviewOverrides>({
    decisions: {},
    link: null,
    outcome: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const router = useRouter()

  const { link, outcome } = overrides
  const patientId =
    link && 'patientId' in link ? link.patientId : document.patientId
  const redactions = withDecisions(document.redactions, overrides.decisions)
  const observations = withDecisions(document.observations, overrides.decisions)
  const creating = link !== null && 'create' in link
  const linked = isLinked(document, link)
  const pending = pendingCount(redactions) + pendingCount(observations)
  const syncing = isSyncing(document, overrides)
  const status = outcome ?? document.status
  const mode = reviewMode(status)
  const readOnly = mode !== 'review'

  const redactionItems: ReviewItem[] = redactions.map((redaction) => ({
    ...redaction,
    label: redaction.category,
    detail: `Page ${redaction.page}`,
    redactionIcon: redactionIconKind(redaction.category),
  }))
  const observationItems: ReviewItem[] = observations.map((observation) => ({
    ...observation,
    observation,
    label:
      `${observation.name} ${observation.value} ${observation.unit}`.trim(),
    detail: `${formatDate(observation.date)} · page ${observation.page}`,
  }))

  const selectedObservation = observations.find(
    (observation) => observation.id === selected?.id
  )
  const selectedTrend =
    selectedObservation &&
    observationTrends(observations).find(
      (trend) =>
        trend.kind === selectedObservation.kind &&
        trend.name === selectedObservation.name &&
        trend.unit === selectedObservation.unit
    )

  const regions = [...redactions, ...observations]
  const outlines = reviewOutlines(redactions, observations, page, selected?.id)

  const handleDeselect = useCallback(() => setSelected(null), [])

  function handleSelect(item: ReviewItem) {
    setSelected(item)
    setPage(item.page)
  }

  // Shows the change at once, then rolls back only that change if the service refuses it.
  async function submit(
    action: ReviewAction,
    change: (current: ReviewOverrides) => ReviewOverrides,
    rollback: (current: ReviewOverrides) => ReviewOverrides
  ) {
    setError(null)
    setOverrides(change)
    const failure = await submitReview(document.id, action)
    if (failure) {
      setOverrides(rollback)
      setError(failure)
      return
    }
    router.refresh()
  }

  function handleDecide(id: string, decision: Decision) {
    const previous = overrides.decisions[id]
    const setDecision =
      (value: Decision | undefined) => (current: ReviewOverrides) => {
        const { [id]: _replaced, ...decisions } = current.decisions
        return {
          ...current,
          decisions: value ? { ...decisions, [id]: value } : decisions,
        }
      }
    const action: ReviewAction = document.redactions.some(
      (item) => item.id === id
    )
      ? { type: 'redaction.update', redactionId: id, status: decision }
      : { type: 'observation.update', observationId: id, status: decision }
    void submit(action, setDecision(decision), setDecision(previous))
  }

  function handleRelink(next: LinkOverride) {
    const previous = link
    void submit(
      'patientId' in next
        ? { type: 'patient.link', patientId: next.patientId }
        : { type: 'patient.create' },
      (current) => ({ ...current, link: next }),
      (current) => ({ ...current, link: previous })
    )
  }

  function handleFinish(type: 'markReviewed' | 'discard') {
    void submit(
      { type },
      (current) => ({
        ...current,
        outcome: type === 'discard' ? 'discarded' : 'reviewed',
      }),
      (current) => ({ ...current, outcome: null })
    )
  }

  const blocker = !linked
    ? 'Link the document to a patient with a strong match.'
    : pending > 0
      ? `${pending} ${pending === 1 ? 'item needs' : 'items need'} review.`
      : syncing
        ? 'Saving review decisions.'
        : 'Ready to mark as reviewed.'

  return (
    <div className="flex h-[calc(100svh-54px)] min-h-[620px] flex-col">
      <ProcessingRefresh
        path={`/documents/${document.id}`}
        active={mode === 'processing' || syncing}
      />
      <header className="flex min-h-[83px] shrink-0 items-center gap-3 border-b bg-card px-6 py-3">
        <Button
          variant="outline"
          size="icon-lg"
          className="size-8 shrink-0 rounded-md border bg-card p-0 text-muted-foreground"
          aria-label="Back to documents"
          nativeButton={false}
          render={<Link href="/documents" />}
        >
          <ArrowLeft />
        </Button>
        <div className="min-w-0 [&_h1]:mt-1 [&_h1]:mb-1 [&_h1]:text-[15px] [&_h1]:font-semibold">
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            DOCUMENT REVIEW · {document.id}
          </div>
          <h1 className="flex items-center gap-2">
            {document.fileName}
            <StatusBadge status={outcome ?? document.status} />
          </h1>
          <span className="text-[9.5px] text-muted-foreground capitalize">
            {document.documentClass ?? 'Pending classification'} ·{' '}
            {document.pages} pages · uploaded {formatDate(document.uploadedAt)}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[87px_minmax(0,1fr)_337px] max-lg:grid-cols-[74px_minmax(0,1fr)_300px]">
        <nav
          aria-label="Pages"
          className="min-h-0 border-r bg-card/50 px-2.5 py-3 overflow-y-auto"
        >
          {document.pageImages.map((image, index) => {
            const number = index + 1
            const flagged = regions.some(
              (item) => item.page === number && item.state === 'needsReview'
            )
            return (
              <button
                key={image.src}
                type="button"
                aria-label={`Page ${number}`}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
                className="relative w-[65px] rounded-md border border-transparent p-1 aria-current:border-primary aria-current:bg-accent flex flex-col items-center gap-1"
              >
                <span
                  style={{ aspectRatio: `${image.width}/${image.height}` }}
                  className={cn(
                    'relative w-full overflow-hidden rounded-sm bg-white ring-1 ring-border',
                    number === page && 'ring-2 ring-primary'
                  )}
                >
                  <Image
                    src={image.thumbnail}
                    alt=""
                    fill
                    sizes="5rem"
                    unoptimized
                  />
                  {flagged && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-warning" />
                  )}
                </span>
                <span className="text-[8px] text-muted-foreground">
                  Page {number}
                </span>
              </button>
            )
          })}
          {document.pageImages.length === 0 &&
            Array.from({ length: document.pages || 1 }, (_, index) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: Placeholders stand in for page numbers.
                key={index}
                className="mx-auto mt-1 mb-5 aspect-[8.5/11] w-[57px] rounded-sm"
              />
            ))}
        </nav>

        <PageViewer
          images={document.pageImages}
          page={page}
          onPage={setPage}
          outlines={outlines}
          onDeselect={handleDeselect}
        />

        <aside className="flex min-h-0 flex-col border-l bg-card">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            className="h-[43px] shrink-0 border-b px-3 [&_[data-slot=tabs-list]]:h-full"
          >
            <TabsList variant="line" className="w-full">
              <TabsTrigger
                className="px-1 text-[9px] data-active:text-primary"
                value="general"
              >
                General
                {(!linked || pendingCount(redactions) > 0) && <Dot />}
              </TabsTrigger>
              <TabsTrigger
                className="px-1 text-[9px] data-active:text-primary"
                value="observations"
              >
                Observations
                {pendingCount(observations) > 0 && <Dot />}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="min-h-0 flex-1 overflow-auto px-[15px] py-4">
            {tab === 'general' && (
              <div className="flex flex-col gap-3">
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold">Patient identity</h2>
                  <PatientPanel
                    document={document}
                    patients={patients}
                    patientId={patientId}
                    creating={creating}
                    readOnly={readOnly}
                    onLink={(id) => handleRelink({ patientId: id })}
                    onCreate={() => handleRelink({ create: true })}
                  />
                </section>
                <section className="flex flex-col gap-3 border-t pt-4">
                  <h2 className="text-sm font-semibold">Redactions</h2>
                  <ReviewItems
                    items={redactionItems}
                    page={page}
                    selectedId={selected?.id ?? null}
                    readOnly={readOnly}
                    onSelect={handleSelect}
                    onDecide={handleDecide}
                  />
                </section>
              </div>
            )}
            {tab === 'observations' && (
              <div className="flex min-w-0 flex-col gap-4">
                {selectedTrend ? <ObservationTrend {...selectedTrend} /> : null}
                <ReviewItems
                  items={observationItems}
                  page={page}
                  selectedId={selected?.id ?? null}
                  readOnly={readOnly}
                  onSelect={handleSelect}
                  onDecide={handleDecide}
                />
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="flex h-[62px] shrink-0 items-center justify-between gap-3 border-t bg-card px-[22px]">
        <div className="flex items-center gap-2 [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_strong]:text-[9px] [&_div>span]:text-[8px] [&_div>span]:text-muted-foreground">
          <Avatar className="size-[29px]">
            <AvatarFallback className="bg-accent text-[9px] font-bold text-accent-foreground">
              {patients.find((patient) => patient.id === patientId)?.initials ??
                (creating ? document.proposedPatient?.initials : undefined) ??
                '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <span>Reviewing for</span>
            <strong>
              {patientId ?? (creating ? 'New patient' : 'No patient linked')}
            </strong>
          </div>
        </div>
        {error ? (
          <p className="ml-auto text-[9px] text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="ml-auto text-[9px] text-muted-foreground" role="status">
            {status === 'failed'
              ? 'Processing failed. This document cannot be reviewed.'
              : status === 'reviewed'
                ? 'Reviewed. The document is read-only.'
                : status === 'discarded'
                  ? 'Discarded. This document contributes no data.'
                  : status === 'unsupported'
                    ? `Unsupported document class: ${document.documentClass ?? 'Pending classification'} documents are not extracted.`
                    : mode === 'processing'
                      ? 'Processing. Review becomes available after extraction.'
                      : blocker}
          </p>
        )}
        {canDiscard(status) && (
          <div className="flex gap-2 [&_button]:h-[33px] [&_button]:text-[11px]">
            <Button
              variant="outline"
              size="lg"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingDiscard(true)}
            >
              Discard document
            </Button>
            {!readOnly && (
              <Button
                size="lg"
                disabled={!canMarkReviewed(document, overrides)}
                onClick={() => handleFinish('markReviewed')}
              >
                <Check data-icon="inline-start" />
                Mark as reviewed
              </Button>
            )}
          </div>
        )}
      </footer>

      <Dialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
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
            <Button
              variant="destructive"
              onClick={() => {
                handleFinish('discard')
                setConfirmingDiscard(false)
              }}
            >
              Discard document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Dot() {
  return <span className="size-1.5 rounded-full bg-warning" />
}
