import { formatDate } from '#lib/format'

const width = 480

const height = 140

const pad = { top: 12, right: 12, bottom: 22, left: 36 }

type Point = { date: string; value: number }

/** Line chart of one observation's values over time, one point per date. */
export function ObservationTrend({
  name,
  unit,
  points,
}: {
  name: string
  unit: string
  points: Point[]
}) {
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (index: number) =>
    pad.left +
    (index / Math.max(points.length - 1, 1)) * (width - pad.left - pad.right)
  const y = (value: number) =>
    pad.top +
    (1 - (value - min) / (max - min || 1)) * (height - pad.top - pad.bottom)
  const first = points[0]
  const last = points.at(-1)

  return (
    <figure className="rounded-lg border bg-card p-4">
      <figcaption className="mb-3 flex items-start justify-between [&_h2]:mt-1.5 [&_h2]:text-[13px]">
        <div>
          <div className="text-[9px] font-bold tracking-[.12em] text-muted-foreground">
            LAB TREND
          </div>
          <h2>{name}</h2>
        </div>
        {last && (
          <span className="flex items-baseline gap-2 text-[10px] text-muted-foreground">
            Latest{' '}
            <span className="font-medium text-foreground">{last.value}</span>{' '}
            {unit}
          </span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full text-primary"
        role="img"
        aria-label={`${name} from ${first?.value} to ${last?.value} ${unit} over ${points.length} dates`}
      >
        {[...new Set([min, max])].map((value) => (
          <g key={value} className="text-muted-foreground">
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray="3 4"
            />
            <text
              x={pad.left - 6}
              y={y(value) + 3}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
            >
              {value}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          points={points
            .map((point, index) => `${x(index)},${y(point.value)}`)
            .join(' ')}
        />
        {points.map((point, index) => (
          <circle
            key={point.date}
            cx={x(index)}
            cy={y(point.value)}
            r={2.5}
            fill="currentColor"
          />
        ))}
        {first !== undefined && last !== undefined && (
          <g
            className="text-muted-foreground"
            fontSize={10}
            fill="currentColor"
          >
            <text x={pad.left} y={height - 4}>
              {formatDate(first.date)}
            </text>
            <text x={width - pad.right} y={height - 4} textAnchor="end">
              {formatDate(last.date)}
            </text>
          </g>
        )}
      </svg>
    </figure>
  )
}
