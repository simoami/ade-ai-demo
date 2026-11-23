import { Avatar, AvatarFallback } from '@repo/ui/components/avatar'
import { Card } from '@repo/ui/components/card'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ObservationCard } from '#components/observations/observation-card'
import { ObservationTrend } from '#components/observations/observation-trend'
import { PatientSkeleton } from '#components/record-skeletons'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import { observationTrends } from '#lib/observations'
import { getPatientRecord } from '#lib/server/records'

/** Patient profile: stored demographics, linked documents and lab trends. */
async function PatientRecord({ params }: PageProps<'/patients/[id]'>) {
  const record = await getPatientRecord((await params).id)
  if (!record) notFound()

  const { patient, documents: linked, observations } = record
  const trends = observationTrends(observations)

  return (
    <main className="mx-auto max-w-[1500px] px-[34px] pt-[29px] pb-12 max-lg:px-[22px]">
      <div className="mb-[21px] flex items-center gap-2.5 text-[10px] text-muted-foreground">
        <Link
          href="/patients"
          className="grid size-8 shrink-0 place-items-center rounded-md border bg-card p-0 text-muted-foreground"
          aria-label="Back to patients"
        >
          <ArrowLeft size={16} />
        </Link>
        <span>Patients / Patient profile</span>
      </div>
      <header className="flex items-center gap-[15px] border-b pb-[21px] [&_h1]:mt-1 [&_h1]:mb-2 [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:tracking-tight">
        <Avatar className="size-[55px]">
          <AvatarFallback className="bg-accent text-base font-semibold text-accent-foreground">
            {patient.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            PATIENT PROFILE
          </div>
          <h1>{patient.id}</h1>
          <p className="text-[10px] text-muted-foreground">
            {patient.sex} · born {patient.birthYear ?? 'Unknown'}
          </p>
        </div>
      </header>
      <div className="mt-[17px] mb-[21px] grid grid-cols-2 gap-3 lg:grid-cols-4 [&>div]:flex [&>div]:min-h-[91px] [&>div]:flex-col [&>div]:gap-2 [&>div]:p-3.5 [&_span]:text-[9.5px] [&_span]:text-muted-foreground [&_strong]:text-base [&_strong]:font-semibold [&_small]:text-[9px] [&_small]:text-muted-foreground">
        <Card>
          <span>Documents</span>
          <strong>{linked.length}</strong>
          <small>Linked patient records</small>
        </Card>
        <Card>
          <span>Total pages</span>
          <strong>
            {linked.reduce((count, document) => count + document.pages, 0)}
          </strong>
          <small>Across linked documents</small>
        </Card>
        <Card>
          <span>Observations</span>
          <strong>{observations.length}</strong>
          <small>Extracted from clinical records</small>
        </Card>
        <Card>
          <span>Needs review</span>
          <strong>
            {
              linked.filter((document) => document.status === 'needsReview')
                .length
            }
          </strong>
          <small>Documents awaiting review</small>
        </Card>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <Card render={<section />}>
          <div className="flex items-center justify-between px-4.5 pt-4.5 pb-3.5 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold">
            <div>
              <h2>Documents</h2>
              <span className="text-[10px] text-muted-foreground">
                All records linked to this patient
              </span>
            </div>
          </div>
          <ul className="px-4 pb-3">
            {linked.map((document) => (
              <li
                key={document.id}
                className="relative flex min-h-14 items-center gap-2.5 border-t hover:bg-muted/50"
              >
                <span className="grid h-8 w-7.5 shrink-0 place-items-center rounded border bg-accent/30 text-primary/70">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1 [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-semibold [&_span]:mt-1 [&_span]:block [&_span]:text-[9px] [&_span]:text-muted-foreground">
                  <strong>
                    <Link
                      href={`/documents/${document.id}`}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {document.fileName}
                    </Link>
                  </strong>
                  <span>
                    {formatDate(document.uploadedAt)} · {document.pages} pages ·{' '}
                    {document.documentClass ?? 'Pending classification'}
                  </span>
                </div>
                <StatusBadge status={document.status} />
              </li>
            ))}
          </ul>
        </Card>
        <section
          className="flex flex-col gap-4"
          aria-label="Lab and vital trends"
        >
          {trends.length === 0 ? (
            <Card render={<p />} className="p-4 text-muted-foreground">
              No lab or vital has two dated numeric observations yet.
            </Card>
          ) : (
            trends.map((trend) => (
              <ObservationTrend
                key={`${trend.kind}-${trend.name}-${trend.unit}`}
                {...trend}
              />
            ))
          )}
        </section>
      </div>
      {/* biome-ignore lint/correctness/useUniqueElementIds: Stable fragment destination for the single patient page. */}
      <section
        id="observations"
        aria-label="Observations"
        className="mt-6 space-y-3 scroll-mt-4"
      >
        <h2 className="text-sm font-semibold">Observations</h2>
        {observations.length ? (
          observations.map((observation) => (
            <ObservationCard key={observation.id} observation={observation} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No observations found.
          </p>
        )}
      </section>
    </main>
  )
}

/** Streams the patient profile inside the shared workspace shell. */
export default function PatientPage(props: PageProps<'/patients/[id]'>) {
  return (
    <Suspense fallback={<PatientSkeleton />}>
      <PatientRecord {...props} />
    </Suspense>
  )
}
