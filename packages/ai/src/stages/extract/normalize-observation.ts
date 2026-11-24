import type { ObservationDetails } from '@repo/db'
import { BLOOD_PRESSURE_CODE } from '#loinc'

const NUMBER = '-?\\d+(?:\\.\\d+)?'

/** Parses printed lab bounds and flags without changing their source strings. */
export function normalizeLabDetails(
  details: ObservationDetails,
  value: number | null
): ObservationDetails {
  const range =
    details.referenceRange?.trim().replaceAll('−', '-').replaceAll('–', '-') ??
    ''
  const interval = range.match(new RegExp(`^(${NUMBER})\\s*-\\s*(${NUMBER})$`))
  const upper = range.match(new RegExp(`^(?:<|≤|<=)\\s*(${NUMBER})$`))
  const lower = range.match(new RegExp(`^(?:>|≥|>=)\\s*(${NUMBER})$`))
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
  unit: string | null
  details: ObservationDetails
}

/** Preserves printed names and values while deriving numeric and kind-specific details. */
export function normalizeObservation<T extends Observation>(observation: T) {
  const numeric = observation.value.match(
    new RegExp(`^(${NUMBER})\\s*([a-zA-Zµμ%][a-zA-Zµμ/%.-]*)?$`)
  )
  const valueNumeric = observation.details.components?.length
    ? null
    : numeric
      ? Number(numeric[1])
      : null
  const details =
    observation.kind === 'lab'
      ? normalizeLabDetails(observation.details, valueNumeric)
      : observation.kind === 'adverse-event'
        ? {
            ...observation.details,
            serious: normalizeSeriousness(observation.details.seriousness),
          }
        : observation.details

  return {
    ...observation,
    valueNumeric,
    details,
    unit:
      observation.unit ??
      (observation.kind === 'medication' ? (numeric?.[2] ?? null) : null),
  }
}

/** Pairs complementary BP components within one dated document, retaining the first printed label and citation. */
export function combineBloodPressure<
  T extends Observation & { effectiveDate: string | null },
>(rows: T[]): T[] {
  const result: T[] = []
  for (const row of rows) {
    const components = row.details.components
    const previous =
      row.details.code === BLOOD_PRESSURE_CODE &&
      row.effectiveDate &&
      components?.length === 1
        ? result.find(
            (candidate) =>
              candidate.details.code === row.details.code &&
              candidate.effectiveDate === row.effectiveDate &&
              candidate.details.components?.length === 1 &&
              candidate.details.components[0]?.code !== components[0]?.code
          )
        : undefined
    if (!previous) {
      result.push(row)
      continue
    }

    // Descending code order puts systolic (8480-6) before diastolic (8462-4), so the value reads "128/78".
    const merged = [
      ...(previous.details.components ?? []),
      ...(components ?? []),
    ].sort((a, b) => b.code.localeCompare(a.code))
    const flags = [
      ...new Set([previous.details.flag, row.details.flag].filter(Boolean)),
    ].join('; ')
    result[result.indexOf(previous)] = {
      ...previous,
      value: merged.map((component) => component.value).join('/'),
      details: {
        ...previous.details,
        components: merged,
        ...(flags ? { flag: flags } : {}),
      },
    }
  }
  return result
}
