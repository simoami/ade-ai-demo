import { ObservationCard } from '#components/observations/observation-card'
import { groupObservations, type ObservationView } from '#lib/observations'
import type { redactionIconKind } from '#lib/review'
import { DecisionActions } from './review-items/decision-actions.tsx'
import { DecisionLabel } from './review-items/decision-label.tsx'
import { ItemGroup } from './review-items/item-group.tsx'
import { ReviewItemRow } from './review-items/review-item-row.tsx'

/** Selectable source region with optional clinical presentation. */
export type ReviewItem = {
  id: string
  page: number
  label: string
  detail: string
  observation?: ObservationView
  redactionIcon?: ReturnType<typeof redactionIconKind>
  state: 'applied' | 'extracted' | 'needsReview' | 'accepted' | 'rejected'
}

type Decision = 'accepted' | 'rejected'

/** Groups clinical cards by kind while keeping flagged items visible across pages. */
export function ReviewItems({
  items,
  page,
  selectedId,
  readOnly,
  onSelect,
  onDecide,
}: {
  items: ReviewItem[]
  page: number
  selectedId: string | null
  readOnly: boolean
  onSelect: (item: ReviewItem) => void
  onDecide: (id: string, decision: Decision) => void
}) {
  const flagged = items.filter((item) => item.state === 'needsReview')
  const onPage = items.filter(
    (item) => item.page === page && item.state !== 'needsReview'
  )

  const clinical = [...flagged, ...onPage].flatMap((item) =>
    item.observation ? [{ ...item, kind: item.observation.kind }] : []
  )
  const clinicalList = items.some((item) => item.observation)
  const groups = clinicalList
    ? groupObservations(clinical).map((group) => ({
        title: group.title,
        items: group.observations,
      }))
    : [
        ...(flagged.length ? [{ title: 'Needs review', items: flagged }] : []),
        // Redactions list every page; the count sits beside the Redactions title, so this group has no heading.
        {
          title: null,
          items: items.filter((item) => item.state !== 'needsReview'),
        },
      ]

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground p-2">
          Nothing on this page.
        </p>
      )}
      {groups.map((group) => (
        <ItemGroup
          key={group.title ?? 'page'}
          title={group.title}
          count={group.items.length}
          separateCards={clinicalList}
        >
          {group.items.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {clinicalList
                ? 'Nothing else on this page.'
                : flagged.length
                  ? 'No other redactions.'
                  : 'No redactions.'}
            </li>
          )}
          {group.items.map((item) => {
            const actions =
              item.state === 'needsReview' && !readOnly ? (
                <DecisionActions
                  key={item.id}
                  onAccept={() => onDecide(item.id, 'accepted')}
                  onReject={() => onDecide(item.id, 'rejected')}
                />
              ) : undefined

            return item.observation ? (
              <li key={item.id}>
                <ObservationCard
                  observation={item.observation}
                  actions={actions}
                  selected={item.id === selectedId}
                  onSelect={() => onSelect(item)}
                />
              </li>
            ) : (
              <ReviewItemRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={onSelect}
              >
                {actions ??
                  ((item.state === 'accepted' || item.state === 'rejected') && (
                    <DecisionLabel state={item.state} />
                  ))}
              </ReviewItemRow>
            )
          })}
        </ItemGroup>
      ))}
    </div>
  )
}
