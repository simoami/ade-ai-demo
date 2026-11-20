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
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import { matchStrength, pendingCount } from '#lib/review'
import type { Patient, ReviewDocument } from '#lib/sample-records'
import { PageViewer } from './page-viewer.tsx'
import { PatientPanel } from './patient-panel.tsx'
import { type ReviewItem, ReviewItems } from './review-items.tsx'

type Tab = 'patient' | 'redactions' | 'observations'

type Outcome = 'reviewed' | 'discarded'

/** Review screen: page rail, redacted page viewer, and the patient, redaction and observation panels. */
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
  const readOnly = outcome !== null

  const redactionItems: ReviewItem[] = redactions.map((redaction) => ({
    ...redaction,
    label: redaction.category,
    detail: `Page ${redaction.page}`,
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
    .map(({ id, box }) => ({
      id,
      box,
      tone: id === selected?.id ? ('selected' as const) : ('review' as const),
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
    <div className="flex h-svh flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Back to documents"
          nativeButton={false}
          render={<Link href="/documents" />}
        >
          <ArrowLeft />
        </Button>
        <div className="flex min-w-0 flex-col">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            {document.fileName}
            <StatusBadge status={outcome ?? document.status} />
          </h1>
          <span className="text-xs text-muted-foreground capitalize">
            {document.documentClass} · {document.pages} pages · uploaded{' '}
            {formatDate(document.uploadedAt)}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[6.5rem_minmax(0,1fr)_24rem]">
        <nav
          aria-label="Pages"
          className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r p-3"
        >
          {document.pageImages.map((src, index) => {
            const number = index + 1
            const flagged = regions.some(
              (item) => item.page === number && item.state === 'needsReview'
            )
            return (
              <button
                key={src}
                type="button"
                aria-label={`Page ${number}`}
                aria-current={number === page ? 'page' : undefined}
                onClick={() => setPage(number)}
                className="group flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'relative aspect-[1000/1294] w-full overflow-hidden rounded-sm bg-white ring-1 ring-border',
                    number === page && 'ring-2 ring-primary'
                  )}
                >
                  <Image src={src} alt="" fill sizes="5rem" />
                  {flagged && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-amber-500" />
                  )}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {number}
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

        <aside className="flex min-h-0 flex-col border-l">
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            className="shrink-0 border-b px-3 pt-2 pb-1"
          >
            <TabsList variant="line" className="w-full">
              <TabsTrigger value="patient">
                Patient
                {!linked && <Dot />}
              </TabsTrigger>
              <TabsTrigger value="redactions">
                Redactions
                {pendingCount(redactions) > 0 && <Dot />}
              </TabsTrigger>
              <TabsTrigger value="observations">
                Observations
                {pendingCount(observations) > 0 && <Dot />}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
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

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-4 py-3">
        <p className="text-sm text-muted-foreground" role="status">
          {outcome === 'reviewed'
            ? 'Marked as reviewed. The document is now read-only.'
            : outcome === 'discarded'
              ? 'Discarded. This document contributes no data.'
              : blocker}
        </p>
        {!readOnly && (
          <div className="flex gap-2">
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
  return <span className="size-1.5 rounded-full bg-amber-500" />
}
