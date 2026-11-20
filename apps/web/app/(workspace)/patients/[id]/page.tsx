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
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
          {patient.initials}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {patient.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {patient.sex} · born {patient.birthYear}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Documents</h2>
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {linked.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex flex-col">
                  {findReviewDocument(document.id) ? (
                    <Link
                      href={`/documents/${document.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {document.fileName}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">
                      {document.fileName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground capitalize">
                    {document.documentClass} · {formatDate(document.uploadedAt)}
                  </span>
                </div>
                <StatusBadge status={document.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Lab trends</h2>
          {trends.length === 0 ? (
            <p className="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
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
