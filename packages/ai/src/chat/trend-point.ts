import { DIASTOLIC_CODE, SYSTOLIC_CODE } from '#loinc'
import type { ObservationView } from './tools.ts'

/**
 * One chart point shared by the assistant's trend tool and the patient page charts.
 * A blood-pressure panel carries `systolic` and `diastolic` series unless one component is selected.
 */
export function trendPoint(
  row: ObservationView,
  flag: string | null | undefined,
  componentCode?: string
) {
  const components = row.details.components ?? []
  const componentValue = (code: string) =>
    components.find((part) => part.code === code)?.value ?? null

  return {
    date: row.date,
    value: componentCode ? componentValue(componentCode) : row.valueNumeric,
    ...(!componentCode && components.length
      ? {
          systolic: componentValue(SYSTOLIC_CODE),
          diastolic: componentValue(DIASTOLIC_CODE),
        }
      : {}),
    // Review state joins the clinical flag ("high; unverified"), so unchecked points read alike in every chart.
    flag:
      [flag, row.state === 'accepted' ? null : 'unverified']
        .filter(Boolean)
        .join('; ') || null,
    documentId: row.documentId,
    page: row.page,
  }
}
