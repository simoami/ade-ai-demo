'use client'

import { upload } from '@repo/storage/client'
import { buttonVariants } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { CloudUpload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import { uploadError } from '#lib/upload'
import {
  uploadDestination,
  uploadDocuments,
  uploadSummary,
} from '#lib/upload-flow'

/** Drop zone that validates a selection against the upload rule before it is sent. */
export function UploadZone() {
  const inputId = useId()
  const router = useRouter()
  const busy = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string }>()

  async function select(files: FileList | null) {
    if (busy.current) return

    const list = Array.from(files ?? [])
    const error = uploadError(list)
    if (error) {
      setMessage({ error: true, text: error })
      return
    }

    busy.current = true
    setUploading(true)
    setMessage({ error: false, text: 'Uploading: 0%' })
    try {
      const results = await uploadDocuments(
        list,
        async (file, progress) => {
          const blob = await upload(`uploads/${file.name}`, file, {
            access: 'private',
            handleUploadUrl: '/api/uploads',
            onUploadProgress: ({ percentage }) => progress(percentage),
          })
          return blob.pathname
        },
        (percentage) =>
          setMessage({
            error: false,
            text:
              percentage === 100
                ? 'Starting document processing…'
                : `Uploading: ${percentage}%`,
          })
      )
      const destination = uploadDestination(results)
      if (destination) {
        router.push(destination)
      } else {
        setMessage({
          error: results.some((result) => result.failed),
          text: uploadSummary(results),
        })
        router.refresh()
      }
    } catch {
      setMessage({
        error: true,
        text: 'Upload could not be completed. Please try again.',
      })
    } finally {
      busy.current = false
      setUploading(false)
    }
  }

  return (
    <label
      htmlFor={inputId}
      aria-busy={uploading}
      className={cn(
        'relative flex min-h-[90px] items-center gap-3.5 rounded-lg border border-dashed border-primary/30 bg-accent/20 px-[18px] py-4 cursor-pointer flex-wrap has-focus-visible:ring-2 has-focus-visible:ring-ring',
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
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
        <CloudUpload className="size-5" />
      </span>
      <div className="flex flex-col gap-1 [&>strong]:text-xs min-w-48 flex-1">
        <strong>Drop files to start a review</strong>
        <span className="text-xs text-muted-foreground">
          Up to 10 PDF, PNG or JPEG files. Each file becomes a separate
          document. 20 MB per file.
        </span>
        {message !== undefined && (
          <span
            role={message.error ? 'alert' : 'status'}
            className={cn(
              'mt-2 rounded-md border px-3 py-2 text-sm font-medium',
              message.error
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-primary/30 bg-accent text-accent-foreground'
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
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          void select(event.target.files)
          event.target.value = ''
        }}
      />
      <span
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-[35px] text-[11px]'
        )}
      >
        Choose files
      </span>
    </label>
  )
}
