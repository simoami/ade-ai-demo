import type { Metadata } from 'next'
import { Noto_Sans } from 'next/font/google'
import '@repo/ui/globals.css'

const fontSans = Noto_Sans({ subsets: ['latin'], variable: '--font-noto-sans' })

/** Document metadata for the application shell. */
export const metadata: Metadata = {
  title: 'Clinical records',
  description: 'Clinical records pipeline demo',
}

/** Provides shared styles and the application document shell. */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fontSans.variable} font-sans antialiased`}>
      <body>{children}</body>
    </html>
  )
}
