import type { ReactNode } from 'react'

/** Titled section holding the patient panel. */
export function PatientIdentitySection({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Patient identity</h2>
      {children}
    </section>
  )
}
