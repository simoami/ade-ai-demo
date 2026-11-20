'use client'

import { buttonVariants } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { CloudUpload } from 'lucide-react'
import { useId, useState } from 'react'
import { uploadError } from '#lib/upload'

/** Drop zone that validates a selection against the upload rule before it is sent. */
export function UploadZone() {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string }>()

  function select(files: FileList | null) {
    const list = Array.from(files ?? [])
    const error = uploadError(list)
    setMessage(
      error
        ? { error: true, text: error }
        : {
            error: false,
            text: `${list.length === 1 ? 'File' : `${list.length} pages`} accepted. Uploading arrives with document storage.`,
          }
    )
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer flex-wrap items-center gap-4 rounded-lg border border-dashed bg-card p-4 transition-colors hover:bg-muted/40 has-focus-visible:ring-2 has-focus-visible:ring-ring',
        dragging && 'border-primary bg-accent'
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        select(event.dataTransfer.files)
      }}
    >
      <span className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
        <CloudUpload className="size-5" />
      </span>
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">Drop a document here</span>
        <span className="text-xs text-muted-foreground">
          One PDF, or up to 30 PNG or JPEG images that become its pages in
          order. 20 MB in total.
        </span>
        {message !== undefined && (
          <span
            role="status"
            className={cn(
              'mt-1 text-xs',
              message.error ? 'text-destructive' : 'text-accent-foreground'
            )}
          >
            {message.text}
          </span>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        multiple
        className="sr-only"
        onChange={(event) => select(event.target.files)}
      />
      <span className={buttonVariants({ variant: 'outline' })}>
        Choose files
      </span>
    </label>
  )
}
