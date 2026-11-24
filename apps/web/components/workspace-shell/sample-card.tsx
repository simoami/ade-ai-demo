import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Download } from 'lucide-react'
import { cacheLife, cacheTag } from 'next/cache'
import { sampleDocuments } from '#lib/sample-documents'

/** Cached list of synthetic sample PDFs to download and upload. */
export async function SampleCard({ samplesId }: { samplesId: string }) {
  'use cache'
  cacheLife('max')
  cacheTag('samples')
  return (
    <Card
      render={<section />}
      id={samplesId}
      aria-labelledby={`${samplesId}-title`}
      className="mt-6 overflow-y-auto p-3 text-[11px]"
    >
      <h2 id={`${samplesId}-title`} className="text-xs font-semibold">
        Sample documents
      </h2>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        Download one, then upload it to see the pipeline
      </p>
      <ul className="mt-2 divide-y">
        {sampleDocuments.map((sample) => (
          <li key={sample.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{sample.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {sample.pages} {sample.pages === 1 ? 'page' : 'pages'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <a
                  href={`/sample-documents/${sample.id}.pdf`}
                  download={sample.downloadName}
                  aria-label={`Download ${sample.name}`}
                />
              }
            >
              <Download className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
