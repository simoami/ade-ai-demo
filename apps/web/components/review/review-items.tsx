import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import {
  Check,
  Image,
  ScanFace,
  Signature,
  Type,
  UserSquare,
  X,
} from 'lucide-react'
import { ObservationCard } from '#components/observations/observation-card'
import { groupObservations, type ObservationView } from '#lib/observations'
import type { redactionIconKind } from '#lib/review'

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

const redactionIcons = {
  text: Type,
  patientPhoto: UserSquare,
  face: ScanFace,
  signature: Signature,
  picture: Image,
}

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
        { title: `Page ${page}`, items: onPage },
      ]

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">Nothing on this page.</p>
      )}
      {groups.map((group) => (
        <ItemGroup
          key={group.title}
          title={group.title}
          count={group.items.length}
          separateCards={clinicalList}
        >
          {group.items.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Nothing else on this page.
            </li>
          )}
          {group.items.map((item) => {
            const actions =
              item.state === 'needsReview' && !readOnly ? (
                <div key={item.id} className="flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDecide(item.id, 'accepted')}
                  >
                    <Check data-icon="inline-start" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDecide(item.id, 'rejected')}
                  >
                    <X data-icon="inline-start" />
                    Reject
                  </Button>
                </div>
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
              <Row
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={onSelect}
              >
                {actions ??
                  ((item.state === 'accepted' || item.state === 'rejected') && (
                    <span
                      className={cn(
                        'text-xs',
                        item.state === 'rejected'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      )}
                    >
                      {item.state === 'accepted' ? 'Accepted' : 'Rejected'}
                    </span>
                  ))}
              </Row>
            )
          })}
        </ItemGroup>
      ))}
    </div>
  )
}

function ItemGroup({
  title,
  count,
  children,
  separateCards,
}: {
  title: string
  count: number
  separateCards: boolean
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col">
      <h3 className="flex items-center gap-1.5 pb-2 text-[11px] font-semibold tracking-wide text-foreground uppercase">
        {title}
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      </h3>
      <ul
        className={
          separateCards
            ? 'flex flex-col gap-2'
            : 'flex flex-col divide-y rounded-md border'
        }
      >
        {children}
      </ul>
    </section>
  )
}

function Row({
  item,
  selected,
  onSelect,
  children,
}: {
  item: ReviewItem
  selected: boolean
  onSelect: (item: ReviewItem) => void
  children?: React.ReactNode
}) {
  const Icon = item.redactionIcon && redactionIcons[item.redactionIcon]

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2',
        selected && 'bg-accent'
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onSelect(item)}
      >
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : null}
        <span className="flex min-w-0 flex-col items-start">
          <span className="max-w-full truncate text-sm font-medium">
            {item.label}
          </span>
          <span className="max-w-full truncate text-xs text-muted-foreground">
            {item.detail}
          </span>
        </span>
      </button>
      {children}
    </li>
  )
}
