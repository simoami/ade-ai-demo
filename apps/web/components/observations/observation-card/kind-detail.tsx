import { Badge } from '@repo/ui/components/badge'
import { cn } from '@repo/ui/lib/utils'
import { formatDate } from '#lib/format'
import {
  type ObservationView,
  observationFlag,
  observationFlagTones,
  referenceRange,
} from '#lib/observations'

/** Kind-specific body of an observation card: measured value, event course, history period or dosing. */
export function KindDetail({ observation }: { observation: ObservationView }) {
  const { kind, value, unit, details } = observation
  const muted = 'text-xs text-muted-foreground'
  const period = [
    details.startDate ? formatDate(details.startDate) : null,
    details.ongoing
      ? 'Ongoing'
      : details.endDate
        ? formatDate(details.endDate)
        : null,
  ]
    .filter(Boolean)
    .join(' – ')

  switch (kind) {
    case 'lab':
    case 'vital': {
      const flag = observationFlag(observation)
      const range = referenceRange(observation)
      return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-lg font-semibold tabular-nums">
            {value}
            {unit && !value.endsWith(unit) && (
              <span className="ms-1 font-sans text-sm font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </span>
          {flag && (
            <Badge
              variant="outline"
              className={cn(
                'border-transparent',
                observationFlagTones[flag].badge
              )}
            >
              {flag}
            </Badge>
          )}
          {range && <span className={muted}>Ref {range}</span>}
          {details.components?.length ? (
            <p className="w-full text-xs text-muted-foreground">
              {details.components
                .map(
                  (component) =>
                    `${component.name.replace(' blood pressure', '')} ${component.value}`
                )
                .join(' · ')}
            </p>
          ) : null}
        </div>
      )
    }
    case 'adverse-event':
      return (
        <div className={cn('flex flex-wrap items-center gap-1.5', muted)}>
          {period && <span>{period}</span>}
          {details.serious ? (
            <Badge variant="destructive">Serious</Badge>
          ) : (
            <span>
              {details.serious === false ? 'Non-serious' : details.seriousness}
            </span>
          )}
          {details.outcome ? (
            <span>· {details.outcome.replaceAll('-', ' ')}</span>
          ) : null}
        </div>
      )
    case 'medical-history':
      return (
        <div className={cn('flex flex-wrap items-center gap-2', muted)}>
          {details.startDate ? (
            <span>
              Since {formatDate(details.startDate)}
              {!details.ongoing && details.endDate
                ? ` – ${formatDate(details.endDate)}`
                : ''}
            </span>
          ) : null}
          {Boolean(details.ongoing) && <Badge variant="outline">Ongoing</Badge>}
        </div>
      )
    case 'medication':
      return (
        <div>
          <p className="font-medium">{value}</p>
          {Boolean(details.route || details.frequency) && (
            <p className={muted}>
              {[details.route, details.frequency].filter(Boolean).join(' · ')}
            </p>
          )}
          {period && <p className={muted}>{period}</p>}
        </div>
      )
    case 'symptom':
      return <p className="text-muted-foreground">{value}</p>
  }
}
