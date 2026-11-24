'use client'

import { useState } from 'react'
import { AdminButton } from './demo-admin/admin-button.tsx'
import { AdminDialog } from './demo-admin/admin-dialog.tsx'
import { WelcomeDialog } from './demo-admin/welcome-dialog.tsx'

/** Workspace administration controls and a browser-only welcome preference. */
export function DemoAdmin({ samplesId }: { samplesId: string }) {
  const [adminOpen, setAdminOpen] = useState(false)

  return (
    <>
      <AdminButton onClick={() => setAdminOpen(true)} />
      <AdminDialog open={adminOpen} onOpenChange={setAdminOpen} />
      <WelcomeDialog samplesId={samplesId} />
    </>
  )
}
