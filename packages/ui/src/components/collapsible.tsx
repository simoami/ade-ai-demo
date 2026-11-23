'use client'

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

/** Shows and hides one panel of content from a trigger. */
function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

/** Toggles its collapsible; carries `data-panel-open` while the panel is shown. */
function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

/** The content shown or hidden by the trigger. */
function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
