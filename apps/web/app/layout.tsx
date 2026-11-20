import type { Metadata } from 'next'
import { Providers } from '#components/providers'
import '@repo/ui/globals.css'

/** Document metadata for the application shell. */
export const metadata: Metadata = {
  title: 'Clinical records',
  description: 'Clinical records pipeline',
}

/** Provides shared styles and the application document shell. */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="font-sans antialiased" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
