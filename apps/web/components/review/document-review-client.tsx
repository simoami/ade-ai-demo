'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { Patient, ReviewDocument } from '#lib/records-types'
import { retainPageUrls } from '#lib/retained-page-urls'
import { reviewPage } from '#lib/review'
import { ReviewWorkspace } from './review-workspace.tsx'

/** Retains browser image URLs across server refreshes and review status transitions. */
export function DocumentReviewClient({
  document,
  patients,
  signedAt,
}: {
  document: ReviewDocument
  patients: Patient[]
  signedAt: number
}) {
  const searchParams = useSearchParams()
  const initialPage = reviewPage(searchParams.get('page'), document.pages)
  const initialTab =
    searchParams.get('tab') === 'observations' ? 'observations' : 'general'
  const [held, setHeld] = useState(() => ({
    source: document.pageImages,
    ...retainPageUrls(new Map(), document.pageImages, signedAt),
  }))

  if (held.source !== document.pageImages) {
    setHeld({
      source: document.pageImages,
      ...retainPageUrls(held.retained, document.pageImages, signedAt),
    })
  }

  return (
    <ReviewWorkspace
      key={`${document.id}:${document.status}:${initialPage}:${initialTab}`}
      initialPage={initialPage}
      initialTab={initialTab}
      document={{ ...document, pageImages: held.images }}
      patients={patients}
    />
  )
}
