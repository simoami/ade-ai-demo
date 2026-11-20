import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ObservationTrend } from '#components/observation-trend'
import { StatusBadge } from '#components/status-badge'
import { formatDate } from '#lib/format'
import { documents, findPatient, findReviewDocument } from '#lib/sample-records'

const trendedLabs = ['Glucose', 'Sodium']

/** Patient profile: stored demographics, linked documents and lab trends. */
export default async function PatientPage({
  params,
}: PageProps<'/patients/[id]'>) {
  const patient = findPatient((await params).id)
  if (!patient) notFound()

  const linked = documents.filter(
    (document) => document.patientId === patient.id
  )
  const observations = linked.flatMap(
    (document) => findReviewDocument(document.id)?.observations ?? []
  )
  const trends = trendedLabs
    .map((name) => {
      const byDate = new Map(
        observations
          .filter((observation) => observation.name === name)
          .map((observation) => [observation.date, observation])
      )
      const sorted = [...byDate.values()].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      return {
        name,
        unit: sorted[0]?.unit ?? '',
        points: sorted.map(({ date, value }) => ({
          date,
          value: Number(value),
        })),
      }
    })
    .filter((trend) => trend.points.length > 1)

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
        <span className="grid size-[55px] place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground">
          {patient.initials}
        </span>
        <div className="flex-1">
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            PATIENT PROFILE
          </div>
          <h1>{patient.id}</h1>
          <p className="text-[10px] text-muted-foreground">
            {patient.sex} · born {patient.birthYear}
          </p>
        </div>
      </header>
      <div className="mt-[17px] mb-[21px] grid grid-cols-2 gap-3 lg:grid-cols-4 [&>div]:flex [&>div]:min-h-[91px] [&>div]:flex-col [&>div]:gap-2 [&>div]:rounded-lg [&>div]:border [&>div]:bg-card [&>div]:p-3.5 [&_span]:text-[9.5px] [&_span]:text-muted-foreground [&_strong]:text-base [&_strong]:font-semibold [&_small]:text-[9px] [&_small]:text-muted-foreground">
        <div>
          <span>Documents</span>
          <strong>{linked.length}</strong>
          <small>Linked patient records</small>
        </div>
        <div>
          <span>Total pages</span>
          <strong>
            {linked.reduce((count, document) => count + document.pages, 0)}
          </strong>
          <small>Across linked documents</small>
        </div>
        <div>
          <span>Observations</span>
          <strong>{observations.length}</strong>
          <small>Extracted from clinical records</small>
        </div>
        <div>
          <span>Needs review</span>
          <strong>
            {
              linked.filter((document) => document.status === 'needsReview')
                .length
            }
          </strong>
          <small>Documents awaiting review</small>
        </div>
      </div>
      <div className="grid items-start gap-[15px] lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-[18px] pt-[18px] pb-3.5 [&_h2]:mb-1 [&_h2]:text-[13px] [&_h2]:font-semibold">
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
                className="relative flex min-h-[58px] items-center gap-2.5 border-t hover:bg-muted/50"
              >
                <span className="grid h-8 w-[30px] shrink-0 place-items-center rounded border bg-accent/30 text-primary/70">
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
                    {document.documentClass}
                  </span>
                </div>
                <StatusBadge status={document.status} />
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-4" aria-label="Lab trends">
          {trends.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-muted-foreground">
              No lab has been recorded on more than one date yet.
            </p>
          ) : (
            trends.map((trend) => (
              <ObservationTrend key={trend.name} {...trend} />
            ))
          )}
        </section>
      </div>
    </main>
  )
}
