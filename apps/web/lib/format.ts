const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** Formats an ISO date or timestamp as a short calendar date. */
export function formatDate(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dateFormat.format(date)
}
