const CITATION_HREF = /^\/documents\/([^/?#]+)\?page=([1-9]\d*)$/

/** Parse an assistant page citation (`/documents/<id>?page=N`); other hrefs return null. */
export function parseCitation(
  href: string | undefined
): { documentId: string; page: number } | null {
  const [, documentId, page] = href?.match(CITATION_HREF) ?? []
  return documentId && page ? { documentId, page: Number(page) } : null
}

/** Number cited pages by first appearance in Markdown; repeated pages reuse their number. */
export function citationNumbers(markdown: string): Map<string, number> {
  const numbers = new Map<string, number>()
  for (const [, href] of markdown.matchAll(/\]\(([^)\s]+)\)/g))
    if (href && parseCitation(href) && !numbers.has(href))
      numbers.set(href, numbers.size + 1)

  return numbers
}
