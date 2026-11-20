import type { PageImage } from './records-types.ts'

type HeldUrl = { url: string; receivedAt: number }

/** Browser-held signed URLs indexed by Blob URL without its rotating query string. */
export type RetainedPageUrls = Map<string, HeldUrl>

/** Keeps a signed URL for ten minutes, replacing it immediately when its Blob pathname changes. */
export function retainPageUrls(
  previous: RetainedPageUrls,
  pages: PageImage[],
  now: number
) {
  const retained: RetainedPageUrls = new Map()
  const keep = (url: string) => {
    const pathname = url.split(/[?#]/, 1)[0] ?? url
    const held = previous.get(pathname)
    const entry =
      held && now - held.receivedAt < 10 * 60_000
        ? held
        : { url, receivedAt: now }
    retained.set(pathname, entry)
    return entry.url
  }
  const images = pages.map((page) => ({
    ...page,
    src: keep(page.src),
    thumbnail: keep(page.thumbnail),
  }))
  return { images, retained }
}
