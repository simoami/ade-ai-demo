'use client'

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
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { cn } from '@repo/ui/lib/utils'
import { ArrowLeft, Check } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ProcessingRefresh } from '#components/processing-refresh'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import type { Patient, ReviewDocument } from '#lib/records-types'
import {
  matchStrength,
  pendingCount,
  redactionIconKind,
  reviewMode,
} from '#lib/review'
import { PageViewer } from './page-viewer.tsx'
import { PatientPanel } from './patient-panel.tsx'
import { type ReviewItem, ReviewItems } from './review-items.tsx'

type Tab = 'patient' | 'redactions' | 'observations'

type Outcome = 'reviewed' | 'discarded'

/** Review screen: page rail, page viewer, and the patient, redaction and observation panels. */
export function ReviewWorkspace({
  document,
  patients,
}: {
  document: ReviewDocument
  patients: Patient[]
}) {
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<Tab>('patient')
  const [selected, setSelected] = useState<ReviewItem | null>(null)
  const [patientId, setPatientId] = useState(document.patientId)
  const [redactions, setRedactions] = useState(document.redactions)
  const [observations, setObservations] = useState(document.observations)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const fields = patientId ? document.patientMatches[patientId] : undefined
  const linked = fields !== undefined && matchStrength(fields) === 'strong'
  const pending = pendingCount(redactions) + pendingCount(observations)
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
    label:
      `${observation.name} ${observation.value} ${observation.unit}`.trim(),
    detail: `${formatDate(observation.date)} · page ${observation.page}`,
  }))

  const regions = [...redactions, ...observations]
  const outlines = regions
    .filter((item) => item.page === page)
    .filter((item) => item.state === 'needsReview' || item.id === selected?.id)
    .map((item) => ({
      id: item.id,
      box: item.box,
      points: 'points' in item ? item.points : undefined,
      tone:
        item.id === selected?.id ? ('selected' as const) : ('review' as const),
    }))

  function select(item: ReviewItem) {
    setSelected(item)
    setPage(item.page)
  }

  function decide(id: string, decision: 'accepted' | 'rejected') {
    setRedactions((items) =>
      items.map((item) =>
        item.id === id ? { ...item, state: decision } : item
      )
    )
    setObservations((items) =>
      items.map((item) =>
        item.id === id ? { ...item, state: decision } : item
      )
    )
  }

  const blocker = !linked
    ? 'Link the document to a patient with a strong match.'
    : pending > 0
      ? `${pending} ${pending === 1 ? 'item needs' : 'items need'} review.`
      : 'Ready to mark as reviewed.'

  return (
    <div className="flex h-[calc(100svh-54px)] min-h-[620px] flex-col">
      <ProcessingRefresh
        path={`/documents/${document.id}`}
        active={mode === 'processing'}
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
        </nav>

        <PageViewer
          images={document.pageImages}
          page={page}
          onPage={setPage}
          outlines={outlines}
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
                value="patient"
              >
                Patient match
                {!linked && <Dot />}
              </TabsTrigger>
              <TabsTrigger
                className="px-1 text-[9px] data-active:text-primary"
                value="redactions"
              >
                Redactions
                {pendingCount(redactions) > 0 && <Dot />}
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
            {tab === 'patient' && (
              <PatientPanel
                document={document}
                patients={patients}
                patientId={patientId}
                readOnly={readOnly}
                onChange={setPatientId}
              />
            )}
            {tab === 'redactions' && (
              <ReviewItems
                items={redactionItems}
                page={page}
                selectedId={selected?.id ?? null}
                readOnly={readOnly}
                onSelect={select}
                onDecide={decide}
              />
            )}
            {tab === 'observations' && (
              <ReviewItems
                items={observationItems}
                page={page}
                selectedId={selected?.id ?? null}
                readOnly={readOnly}
                onSelect={select}
                onDecide={decide}
              />
            )}
          </div>
        </aside>
      </div>

      <footer className="flex h-[62px] shrink-0 items-center justify-between gap-3 border-t bg-card px-[22px]">
        <div className="flex items-center gap-2 [&_div]:flex [&_div]:flex-col [&_div]:gap-1 [&_strong]:text-[9px] [&_div>span]:text-[8px] [&_div>span]:text-muted-foreground">
          <span className="grid size-[29px] place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
            {patients.find((patient) => patient.id === patientId)?.initials ??
              '?'}
          </span>
          <div>
            <span>Reviewing for</span>
            <strong>{patientId ?? 'No patient linked'}</strong>
          </div>
        </div>
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
        {!readOnly && (
          <div className="flex gap-2 [&_button]:h-[33px] [&_button]:text-[11px]">
            <Button
              variant="outline"
              size="lg"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingDiscard(true)}
            >
              Discard document
            </Button>
            <Button
              size="lg"
              disabled={!linked || pending > 0}
              onClick={() => setOutcome('reviewed')}
            >
              <Check data-icon="inline-start" />
              Mark as reviewed
            </Button>
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
                setOutcome('discarded')
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
