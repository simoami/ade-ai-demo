/** Plain text from a vendor's inline HTML: table cells spaced, rows and line breaks kept, tags dropped, basic entities decoded. */
export function htmlText(html: string) {
  return html
    .replace(/<br\s*\/?>|<\/tr>/g, '\n')
    .replace(/<\/t[dh]>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
    .trim()
}
