import { notFound } from 'next/navigation'
import { observationTrends } from '#lib/observations'
import { getPatientRecord } from '#lib/server/records'
import { LinkedDocuments } from './patient-record/linked-documents.tsx'
import { PatientBackLink } from './patient-record/patient-back-link.tsx'
import { PatientObservations } from './patient-record/patient-observations.tsx'
import { PatientProfileHeader } from './patient-record/patient-profile-header.tsx'
import { PatientStats } from './patient-record/patient-stats.tsx'
import { PatientTrends } from './patient-record/patient-trends.tsx'

/** Patient profile: stored demographics, linked documents and lab trends. */
export async function PatientRecord({ params }: PageProps<'/patients/[id]'>) {
  const record = await getPatientRecord((await params).id)
  if (!record) notFound()

  const { patient, documents: linked, observations } = record
  const trends = observationTrends(observations)

  return (
    <main className="mx-auto max-w-[1500px] px-[34px] pt-[29px] pb-12 max-lg:px-[22px]">
      <PatientBackLink />
      <PatientProfileHeader patient={patient} />
      <PatientStats documents={linked} observationCount={observations.length} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <LinkedDocuments documents={linked} />
        <PatientTrends trends={trends} />
      </div>
      <PatientObservations observations={observations} />
    </main>
  )
}
