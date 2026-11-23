import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cn } from '@repo/ui/lib/utils'

/** Shared bordered surface for grouped workspace content; `render` keeps semantic tags such as `ul`, `article` or `figure`. */
export function Card({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'rounded-lg border bg-card text-card-foreground',
          className
        ),
      },
      props
    ),
    render,
    state: { slot: 'card' },
  })
}
