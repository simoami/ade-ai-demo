'use client'

import { Card } from '@repo/ui/components/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@repo/ui/components/chart'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate } from '#lib/format'

/** Numeric observations over time with reference bounds and source-page citations. */
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
    value: number | null
    systolic?: number | null
    diastolic?: number | null
    flag?: string | null
    documentId: string
    page: number
  }[]
  rangeLow: number | null
  rangeHigh: number | null
}) {
  const latest = points.at(-1)
  const bloodPressure = points.some(
    (point) => point.systolic != null || point.diastolic != null
  )
  const reading = (point: (typeof points)[number]) =>
    bloodPressure
      ? `${point.systolic ?? '—'}/${point.diastolic ?? '—'}`
      : point.value

  return (
    <Card render={<figure />} className="min-w-0 rounded-md p-3">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-1 text-sm">
        <span className="font-medium">{name}</span>
        {latest && (
          <span className="text-xs text-muted-foreground">
            Latest {reading(latest)} {unit}
          </span>
        )}
      </figcaption>
      <ChartContainer
        className="h-44 w-full"
        config={{
          systolic: { label: 'Systolic', color: 'var(--chart-1)' },
          diastolic: { label: 'Diastolic', color: 'var(--chart-2)' },
          value: {
            label: unit ? `Result (${unit})` : 'Result',
            color: 'var(--chart-1)',
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatDate}
            minTickGap={32}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          {rangeLow !== null && rangeHigh !== null && (
            <ReferenceArea
              y1={rangeLow}
              y2={rangeHigh}
              fill="var(--success)"
              fillOpacity={0.12}
              ifOverflow="extendDomain"
            />
          )}
          {rangeLow !== null && (
            <ReferenceLine
              y={rangeLow}
              stroke="var(--success)"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
          )}
          {rangeHigh !== null && (
            <ReferenceLine
              y={rangeHigh}
              stroke="var(--success)"
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
          )}
          {bloodPressure && <ChartLegend content={<ChartLegendContent />} />}
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(date) => formatDate(String(date))}
              />
            }
          />
          {(bloodPressure ? ['systolic', 'diastolic'] : ['value']).map(
            (key) => (
              <Line
                key={key}
                dataKey={key}
                type="linear"
                stroke={`var(--color-${key})`}
                strokeWidth={2}
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            )
          )}
        </LineChart>
      </ChartContainer>
      {(rangeLow !== null || rangeHigh !== null) && (
        <p className="mt-1 text-xs text-muted-foreground">
          Reference: {rangeLow ?? '−∞'}–{rangeHigh ?? '∞'} {unit}
        </p>
      )}
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {points.length} source observations
        </summary>
        <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
          {[
            ...new Map(
              points.map((point) => [JSON.stringify(point), point])
            ).entries(),
          ].map(([key, point]) => (
            <li key={key}>
              <Link
                className="underline underline-offset-2"
                href={`/documents/${point.documentId}?page=${point.page}`}
              >
                {formatDate(point.date)} · {reading(point)} {unit}
                {point.flag ? ` · ${point.flag}` : ''} · page {point.page}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
