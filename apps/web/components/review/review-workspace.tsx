'use client'

import type { ReviewAction } from '@repo/ai/review-action'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { ProcessingRefresh } from '#components/processing-refresh'
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
import { DiscardDialog } from './review-workspace/discard-dialog.tsx'
import { ObservationsTab } from './review-workspace/observations-tab.tsx'
import { PageRail } from './review-workspace/page-rail.tsx'
import { PatientIdentitySection } from './review-workspace/patient-identity-section.tsx'
import { RedactionsSection } from './review-workspace/redactions-section.tsx'
import { ReviewActions } from './review-workspace/review-actions.tsx'
import { ReviewFooter } from './review-workspace/review-footer.tsx'
import { ReviewHeader } from './review-workspace/review-header.tsx'
import { ReviewSidePanel } from './review-workspace/review-side-panel.tsx'
import { ReviewStatusMessage } from './review-workspace/review-status-message.tsx'
import { type ReviewTab, ReviewTabs } from './review-workspace/review-tabs.tsx'
import { ReviewingFor } from './review-workspace/reviewing-for.tsx'

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
  initialTab?: ReviewTab
}) {
  const [page, setPage] = useState(initialPage)
  const [tab, setTab] = useState<ReviewTab>(initialTab)
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
  // Exactly one observations-tab state renders: still extracting, nothing found, or the list.
  const observationsView =
    mode === 'processing'
      ? 'processing'
      : observations.length
        ? 'list'
        : 'empty'

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

  function handleConfirmDiscard() {
    handleFinish('discard')
    setConfirmingDiscard(false)
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
  const statusMessage =
    status === 'failed'
      ? 'Processing failed. This document cannot be reviewed.'
      : status === 'reviewed'
        ? 'Reviewed. The document is read-only.'
        : status === 'discarded'
          ? 'Discarded. This document contributes no data.'
          : status === 'unsupported'
            ? `Unsupported document class: ${document.documentClass ?? 'Pending classification'} documents are not extracted.`
            : mode === 'processing'
              ? 'Processing. Review becomes available after extraction.'
              : blocker
  const reviewingForInitials =
    patients.find((patient) => patient.id === patientId)?.initials ??
    (creating ? document.proposedPatient?.initials : undefined) ??
    '?'
  const reviewingForLabel =
    patientId ?? (creating ? 'New patient' : 'No patient linked')

  return (
    <div className="flex h-[calc(100svh-54px)] min-h-[620px] flex-col">
      <ProcessingRefresh
        path={`/documents/${document.id}`}
        active={mode === 'processing' || syncing}
      />
      <ReviewHeader document={document} status={status} />

      <div className="grid min-h-0 flex-1 grid-cols-[87px_minmax(0,1fr)_337px] max-lg:grid-cols-[74px_minmax(0,1fr)_300px]">
        <PageRail
          images={document.pageImages}
          pageCount={document.pages}
          page={page}
          regions={regions}
          onPage={setPage}
        />

        <PageViewer
          images={document.pageImages}
          page={page}
          onPage={setPage}
          outlines={outlines}
          onDeselect={handleDeselect}
        />

        <ReviewSidePanel
          tabs={
            <ReviewTabs
              tab={tab}
              onTabChange={setTab}
              generalPending={!linked || pendingCount(redactions) > 0}
              observationsPending={pendingCount(observations) > 0}
              observationCount={
                observationsView === 'list' ? observations.length : null
              }
            />
          }
        >
          {tab === 'general' && (
            <div className="flex flex-col gap-3">
              <PatientIdentitySection>
                <PatientPanel
                  document={document}
                  patients={patients}
                  patientId={patientId}
                  creating={creating}
                  readOnly={readOnly}
                  onLink={(id) => handleRelink({ patientId: id })}
                  onCreate={() => handleRelink({ create: true })}
                />
              </PatientIdentitySection>
              <RedactionsSection count={redactionItems.length}>
                <ReviewItems
                  items={redactionItems}
                  page={page}
                  selectedId={selected?.id ?? null}
                  readOnly={readOnly}
                  onSelect={handleSelect}
                  onDecide={handleDecide}
                />
              </RedactionsSection>
            </div>
          )}
          {tab === 'observations' && (
            <ObservationsTab
              view={observationsView}
              documentClass={document.documentClass}
              trend={selectedTrend}
            >
              <ReviewItems
                items={observationItems}
                page={page}
                selectedId={selected?.id ?? null}
                readOnly={readOnly}
                onSelect={handleSelect}
                onDecide={handleDecide}
              />
            </ObservationsTab>
          )}
        </ReviewSidePanel>
      </div>

      <ReviewFooter>
        <ReviewingFor
          initials={reviewingForInitials}
          label={reviewingForLabel}
        />
        <ReviewStatusMessage error={error} message={statusMessage} />
        {canDiscard(status) && (
          <ReviewActions
            readOnly={readOnly}
            canMarkReviewed={canMarkReviewed(document, overrides)}
            onDiscard={() => setConfirmingDiscard(true)}
            onMarkReviewed={() => handleFinish('markReviewed')}
          />
        )}
      </ReviewFooter>

      <DiscardDialog
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        onDiscard={handleConfirmDiscard}
      />
    </div>
  )
}
