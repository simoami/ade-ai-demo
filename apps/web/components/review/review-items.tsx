import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { Check, X } from 'lucide-react'

export type ReviewItem = {
  id: string
  page: number
  label: string
  detail: string
  state: 'applied' | 'extracted' | 'needsReview' | 'accepted' | 'rejected'
}

type Decision = 'accepted' | 'rejected'

/** Lists flagged items across the document, then the current page's items. */
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

  return (
    <div className="flex flex-col gap-5">
      {flagged.length > 0 && (
        <ItemGroup title={`Needs review · ${flagged.length}`}>
          {flagged.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={onSelect}
            >
              {!readOnly && (
                <div className="flex shrink-0 gap-1">
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
              )}
            </Row>
          ))}
        </ItemGroup>
      )}

      <ItemGroup title={`Page ${page} · ${onPage.length}`}>
        {onPage.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            Nothing else on this page.
          </p>
        ) : (
          onPage.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={onSelect}
            >
              {(item.state === 'accepted' || item.state === 'rejected') && (
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
              )}
            </Row>
          ))
        )}
      </ItemGroup>
    </div>
  )
}

function ItemGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col">
      <h3 className="pb-1.5 text-xs font-medium text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-col divide-y rounded-md border">{children}</ul>
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
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2',
        selected && 'bg-accent'
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start text-left"
        onClick={() => onSelect(item)}
      >
        <span className="truncate text-sm font-medium">{item.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {item.detail}
        </span>
      </button>
      {children}
    </li>
  )
}
