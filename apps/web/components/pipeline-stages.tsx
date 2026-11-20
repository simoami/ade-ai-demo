import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import {
  ChevronRight,
  ClipboardCheck,
  FileScan,
  Image,
  ListFilter,
  ShieldCheck,
  Upload,
} from 'lucide-react'

const stages = [
  {
    label: 'Upload',
    caption: 'One PDF or up to 30 page images',
    icon: Upload,
  },
  {
    label: 'Render',
    caption: 'Pages become images',
    icon: Image,
  },
  {
    label: 'Read',
    caption: 'OCR finds text, layout and words',
    icon: FileScan,
  },
  {
    label: 'Redact',
    caption: 'Identifiers and patient photos are burned out',
    icon: ShieldCheck,
  },
  {
    label: 'Extract',
    caption: 'Observations and patient link',
    icon: ListFilter,
  },
  {
    label: 'Review',
    caption: 'A person accepts, rejects and signs off',
    icon: ClipboardCheck,
  },
]

/** Shows ingestion stages with captions available on hover and keyboard focus. */
export function PipelineStages() {
  return (
    <ol
      aria-label="Document ingestion stages"
      className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6"
    >
      {stages.map(({ label, caption, icon: Icon }, index) => (
        <li key={label} className="relative flex">
          <Tooltip>
            <TooltipTrigger
              aria-label={`${label}: ${caption}`}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-primary/15 bg-accent py-3 text-xs text-accent-foreground outline-none hover:ring-1 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-popover"
            >
              <Icon aria-hidden="true" className="size-4 text-primary" />
              <span className="font-medium">{label}</span>
            </TooltipTrigger>
            <TooltipContent>{caption}</TooltipContent>
          </Tooltip>
          {index < stages.length - 1 && (
            <ChevronRight
              aria-hidden="true"
              className="absolute top-1/2 -right-3.5 size-3 -translate-y-1/2 text-muted-foreground"
            />
          )}
        </li>
      ))}
    </ol>
  )
}
