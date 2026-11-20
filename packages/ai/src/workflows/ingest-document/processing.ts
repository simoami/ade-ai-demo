import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storage } from '@repo/storage'
import sharp from 'sharp'
import { ocrPages } from '#stages/ocr/ocr-pages'
import type { OcrProvider } from '#stages/ocr/ocr-result'
import { renderImages, renderPdf } from '#stages/render/render-pages'
import { encryptArtifact, encryptionKey } from './artifact-encryption.ts'
import { updateDocument } from './document-store.ts'

/** Original Blob references in page order; content stays inside processing steps. */
export type IngestInput = {
  documentId: string
  fileName: string
  pathnames: string[]
}

type Dependencies = {
  storage: Pick<typeof storage, 'get' | 'put'>
  update: typeof updateDocument
  renderPdf: typeof renderPdf
  renderImages: typeof renderImages
  ocr: typeof ocrPages
  key: () => Buffer
}

const defaults: Dependencies = {
  storage,
  update: updateDocument,
  renderPdf,
  renderImages,
  ocr: ocrPages,
  key: () => encryptionKey(process.env.DOCUMENT_ENCRYPTION_KEY),
}

async function readBlob(pathname: string, deps: Dependencies) {
  const blob = await deps.storage.get(pathname)
  if (!blob) throw new Error('Missing document artifact')

  const reader = blob.stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      size += value.byteLength
      if (size > 20 * 1024 * 1024) {
        await reader.cancel()
        throw new Error('Document artifact exceeds size limit')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  return {
    bytes: Buffer.concat(chunks),
    contentType: blob.contentType.split(';')[0]?.trim(),
  }
}

/** Downloads originals into an isolated scratch directory and persists internal full-size renders and WebP thumbnails. */
export async function renderDocument(
  input: IngestInput,
  overrides: Partial<Dependencies> = {}
) {
  const deps = { ...defaults, ...overrides }
  const directory = await mkdtemp(join(tmpdir(), 'ade-render-'))
  try {
    await deps.update(input.documentId, { status: 'rendering' })
    const inputs: string[] = []
    let totalBytes = 0
    let pdf = false
    for (const [index, pathname] of input.pathnames.entries()) {
      const { bytes, contentType } = await readBlob(pathname, deps)
      totalBytes += bytes.length
      if (totalBytes > 20 * 1024 * 1024)
        throw new Error('Document exceeds size limit')

      if (contentType === 'application/pdf') {
        if (
          input.pathnames.length !== 1 ||
          !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
        )
          throw new Error('Invalid PDF upload')
        pdf = true
      } else if (contentType === 'image/png' || contentType === 'image/jpeg') {
        const { format } = await sharp(bytes).metadata()
        if (format !== 'png' && format !== 'jpeg')
          throw new Error('Invalid image upload')
      } else {
        throw new Error('Unsupported upload type')
      }

      const path = join(directory, `original-${index}`)
      await writeFile(path, bytes, { mode: 0o600 })
      inputs.push(path)
    }

    const first = inputs[0]
    if (!first) throw new Error('Document has no originals')

    const output = join(directory, 'render')
    const result = pdf
      ? await deps.renderPdf(first, output)
      : await deps.renderImages(inputs, output)
    if (!result.pages.length || result.pages.length > 30)
      throw new Error('Invalid page count')

    const dimensions: { width: number; height: number }[] = []
    for (const [index, page] of result.pages.entries()) {
      const bytes = await readFile(join(output, `${page.page}.png`))
      const { width, height } = await sharp(bytes).metadata()
      if (!width || !height) throw new Error('Missing page dimensions')

      await deps.storage.put(
        `documents/${input.documentId}/render/${index + 1}.png`,
        bytes,
        {
          contentType: 'image/png',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      await deps.storage.put(
        `documents/${input.documentId}/render/${index + 1}-thumb.webp`,
        await readFile(join(output, `${page.page}.webp`)),
        {
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      )
      dimensions.push({ width, height })
    }

    await deps.update(input.documentId, {
      pageDimensions: dimensions,
      status: 'reading',
    })
    return { pageCount: dimensions.length }
  } catch {
    await deps.update(input.documentId, { status: 'failed' })
    throw new Error('Document rendering failed')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/** Transcribes internal pages and stores authenticated ciphertext without returning OCR to workflow history. */
export async function readDocument(
  documentId: string,
  pageCount: number,
  overrides: Partial<Dependencies> = {},
  provider?: OcrProvider
) {
  const deps = { ...defaults, ...overrides }
  try {
    const key = deps.key()
    await deps.update(documentId, { status: 'reading' })
    const pages: Uint8Array[] = []
    for (let page = 1; page <= pageCount; page++) {
      pages.push(
        (await readBlob(`documents/${documentId}/render/${page}.png`, deps))
          .bytes
      )
    }

    const result = await deps.ocr(pages, provider)
    const ciphertext = encryptArtifact(Buffer.from(JSON.stringify(result)), key)
    await deps.storage.put(`documents/${documentId}/ocr.json.enc`, ciphertext, {
      contentType: 'application/octet-stream',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    await deps.update(documentId, { status: 'redacting' })

    return { pageCount: result.length }
  } catch {
    await deps.update(documentId, { status: 'failed' })
    throw new Error('Document reading failed')
  }
}

/** Persists either terminal review decision; repeated calls produce the same status. */
export async function completeDocument(
  documentId: string,
  status: 'reviewed' | 'discarded',
  update = updateDocument
) {
  await update(documentId, { status })
}
