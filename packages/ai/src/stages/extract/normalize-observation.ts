import type { ObservationDetails } from '@repo/db'

const number = '-?\\d+(?:\\.\\d+)?'

/** Parses printed lab bounds and flags without changing their source strings. */
export function normalizeLabDetails(
  details: ObservationDetails,
  value: number | null
): ObservationDetails {
  const range =
    details.referenceRange?.trim().replaceAll('−', '-').replaceAll('–', '-') ??
    ''
  const interval = range.match(new RegExp(`^(${number})\\s*-\\s*(${number})$`))
  const upper = range.match(new RegExp(`^(?:<|≤|<=)\\s*(${number})$`))
  const lower = range.match(new RegExp(`^(?:>|≥|>=)\\s*(${number})$`))
  const rangeLow = interval
    ? Number(interval[1])
    : lower
      ? Number(lower[1])
      : null
  const rangeHigh = interval
    ? Number(interval[2])
    : upper
      ? Number(upper[1])
      : null
  const flag = details.flag?.trim().toLowerCase()
  let flagNormalized: ObservationDetails['flagNormalized'] = null
  if (flag && /^(?:l|ll|low|below|↓)$/.test(flag)) flagNormalized = 'low'
  else if (flag && /^(?:h|hh|high|above|↑)$/.test(flag)) flagNormalized = 'high'
  else if (flag && /^(?:n|normal|within range)$/.test(flag))
    flagNormalized = 'normal'
  else if (flag && /^(?:a|abnormal|positive|\*)$/.test(flag))
    flagNormalized = 'abnormal'
  else if (value !== null && (rangeLow !== null || rangeHigh !== null)) {
    flagNormalized =
      rangeLow !== null &&
      (value < rangeLow ||
        (range.startsWith('>') &&
          !range.startsWith('>=') &&
          value === rangeLow))
        ? 'low'
        : rangeHigh !== null &&
            (value > rangeHigh ||
              (range.startsWith('<') &&
                !range.startsWith('<=') &&
                value === rangeHigh))
          ? 'high'
          : 'normal'
  }

  return { ...details, rangeLow, rangeHigh, flagNormalized }
}

/** Derives seriousness only from explicit printed classifications or seriousness criteria. */
export function normalizeSeriousness(
  printed: string | undefined
): boolean | null {
  if (!printed?.trim()) return null
  if (
    /\b(?:non[-\s]?serious|not serious)\b/i.test(printed) ||
    /^no$/i.test(printed.trim())
  )
    return false
  if (/^yes$/i.test(printed.trim())) return true

  if (
    /\b(?:serious|hospitali[sz]ation|life[-\s]threatening|death|fatal|disability|congenital anomaly)\b/i.test(
      printed
    )
  )
    return true

  return null
}

type Observation = {
  kind: string
  name: string
  value: string
  valueNumeric: number | null
  unit: string | null
  details: ObservationDetails
}

/** Normalizes labs, medication doses and both blood pressure formats before deduplication and UUID assignment. */
export function normalizeObservation<T extends Observation>(
  observation: T
): T[] {
  const { kind, name, value } = observation
  const numeric = value.match(
    new RegExp(`^(${number})\\s*([a-zA-Zµμ%][a-zA-Zµμ/%.-]*)?$`)
  )
  const valueNumeric =
    kind === 'medication' && numeric
      ? Number(numeric[1])
      : observation.valueNumeric
  const details =
    kind === 'lab'
      ? normalizeLabDetails(observation.details, valueNumeric)
      : kind === 'adverse-event'
        ? {
            ...observation.details,
            serious: normalizeSeriousness(observation.details.seriousness),
          }
        : observation.details
  const normalized = {
    ...observation,
    valueNumeric,
    details,
    unit:
      kind === 'medication' && !observation.unit
        ? (numeric?.[2] ?? null)
        : observation.unit,
  }
  if (kind !== 'vital') return [normalized]

  const combined = value.match(
    /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*mmHg)?$/i
  )
  if (combined && /\b(?:bp|blood pressure)\b/i.test(name)) {
    return ['Systolic blood pressure', 'Diastolic blood pressure'].map(
      (name, index) => ({
        ...normalized,
        name,
        value: combined[index + 1] ?? '',
        valueNumeric: Number(combined[index + 1]),
        unit: 'mmHg',
      })
    )
  }

  const component = /\b(?:sbp|systolic)\b/i.test(name)
    ? 'Systolic'
    : /\b(?:dbp|diastolic)\b/i.test(name)
      ? 'Diastolic'
      : null
  return [
    {
      ...normalized,
      ...(component
        ? {
            name: `${component} blood pressure`,
            unit: 'mmHg',
            ...(numeric
              ? { value: numeric[1] ?? value, valueNumeric: Number(numeric[1]) }
              : {}),
          }
        : {}),
    },
  ]
}
