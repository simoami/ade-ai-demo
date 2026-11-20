import { revalidateTag } from 'next/cache.js'
import { recordTags } from '#lib/cache-policy'

/** Expires record caches after a successful service write; route handlers cannot use updateTag. */
export const recordCache = {
  invalidate(documentId?: string, patientId?: string) {
    revalidateTag(recordTags.documents, { expire: 0 })
    revalidateTag(recordTags.patients, { expire: 0 })
    if (documentId)
      revalidateTag(recordTags.document(documentId), { expire: 0 })
    if (patientId) revalidateTag(recordTags.patient(patientId), { expire: 0 })
  },
}
