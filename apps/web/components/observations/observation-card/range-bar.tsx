import { cn } from '@repo/ui/lib/utils'
import {
  type ObservationView,
  observationFlag,
  observationFlagTones,
  referenceRange,
} from '#lib/observations'

/** Plots the value against one or both reference bounds, padded so out-of-range values stay visible. */
export function RangeBar({ observation }: { observation: ObservationView }) {
  const { rangeLow: low, rangeHigh: high } = observation.details
  const value = observation.valueNumeric
  const flag = observationFlag(observation)
  if (value === null || !flag || (low == null && high == null)) return null
  if (low != null && high != null && high <= low) return null

  const points = [low, high, value].filter((point) => point != null)
  const spread =
    Math.max(...points) - Math.min(...points) || Math.abs(value) || 1
  const start = Math.min(...points) - spread / 3
  const span = Math.max(...points) + spread / 3 - start
  const percent = (point: number) => ((point - start) / span) * 100
  const normalStart = low == null ? 0 : percent(low)
  const normalEnd = high == null ? 100 : percent(high)

  return (
    <div
      role="img"
      aria-label={`${observation.value} is ${flag}; reference ${referenceRange(observation)}`}
      className="relative mt-1.5 mb-0.5 h-1.5 rounded-full bg-muted"
    >
      <span
        className="absolute inset-y-0 bg-success-muted"
        style={{
          left: `${normalStart}%`,
          width: `${normalEnd - normalStart}%`,
        }}
      />
      {[low, high].map((bound) =>
        bound == null ? null : (
          <span
            key={bound}
            className="absolute -inset-y-1 w-px bg-success"
            // Snap to a whole pixel so 1px markers don't blur at fractional offsets.
            style={{ left: `round(${percent(bound)}%, 1px)` }}
          />
        )
      )}
      <span
        className={cn(
          'absolute top-1/2 size-2.5 -translate-1/2 rounded-full border-2 border-card',
          observationFlagTones[flag].marker
        )}
        style={{ left: `${percent(value)}%` }}
      />
    </div>
  )
}
