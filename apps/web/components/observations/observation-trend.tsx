import Link from 'next/link'

/** Integration placeholder: replace with agent B's shared chart using these props. */
export function ObservationTrend({
  name,
  unit,
  points,
  rangeLow,
  rangeHigh,
}: {
  name: string
  unit: string | null
  points: {
    date: string
    value: number
    flag?: string | null
    documentId: string
    page: number
  }[]
  rangeLow: number | null
  rangeHigh: number | null
}) {
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <p className="font-medium">
        {name} {unit}
      </p>
      {(rangeLow !== null || rangeHigh !== null) && (
        <p>
          Reference range: {rangeLow ?? '—'} – {rangeHigh ?? '—'}
        </p>
      )}
      <ul className="space-y-2">
        {points.map((point) => (
          <li
            key={`${point.documentId}-${point.page}-${point.date}-${point.value}`}
          >
            <Link
              className="text-primary underline"
              href={`/documents/${encodeURIComponent(point.documentId)}?page=${point.page}`}
            >
              {point.date}: {point.value} {unit} · {point.documentId}, page{' '}
              {point.page}
            </Link>
            {Boolean(point.flag) && <p>{point.flag}</p>}
          </li>
        ))}
      </ul>
      {points.length === 0 && <p>No numeric observations found.</p>}
    </section>
  )
}
