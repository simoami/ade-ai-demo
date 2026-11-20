'use client'

import { useState } from 'react'
import type { Patient, ReviewDocument } from '#lib/records-types'
import { retainPageUrls } from '#lib/retained-page-urls'
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
      key={`${document.id}:${document.status}`}
      document={{ ...document, pageImages: held.images }}
      patients={patients}
    />
  )
}
