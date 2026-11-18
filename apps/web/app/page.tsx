import { Button } from '@repo/ui/components/button'

/** Renders the application landing page. */
export default function Page() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Clinical records</h1>
      <Button disabled>Upload records</Button>
    </main>
  )
}
