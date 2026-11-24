import { Suspense } from 'react'
import { PatientRecord } from '#components/patient-record'
import { PatientSkeleton } from '#components/record-skeletons/patient-skeleton'

/** Streams the patient profile inside the shared workspace shell. */
export default function PatientPage(props: PageProps<'/patients/[id]'>) {
  return (
    <Suspense fallback={<PatientSkeleton />}>
      <PatientRecord {...props} />
    </Suspense>
  )
}
