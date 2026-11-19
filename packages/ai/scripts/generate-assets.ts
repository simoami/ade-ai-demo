import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openai } from '@ai-sdk/openai'
import { logger } from '@repo/logger'
import { generateImage } from 'ai'
import sharp from 'sharp'
import { z } from 'zod'

const log = logger.getSubLogger({ name: 'synthetic-assets' })

const model = openai.image('gpt-image-2.6-flare')

const root = fileURLToPath(
  new URL('../../../fixtures/assets/', import.meta.url)
)

const portrait = (subject: string, setting: string) =>
  `Photorealistic portrait of a fictional ${subject}, ${setting}. Head and shoulders, no text, no logos, no watermark.`

/** Generated images used by synthetic fixtures; none depicts a real person. */
export const assetSpecs = [
  {
    file: 'portrait-01.jpg',
    width: 320,
    prompt: portrait(
      'woman in her thirties with dark curly hair',
      'ID photo, plain light gray background, neutral expression, flat lighting'
    ),
  },
  {
    file: 'portrait-02.jpg',
    width: 320,
    prompt: portrait(
      'man in his fifties with a gray beard and glasses',
      'ID photo, plain blue background, neutral expression'
    ),
  },
  {
    file: 'portrait-03.jpg',
    width: 320,
    prompt: portrait(
      'woman in her eighties with short white hair',
      'ID photo, plain off-white background, soft window light'
    ),
  },
  {
    file: 'portrait-04.jpg',
    width: 320,
    prompt: portrait(
      'young man in his twenties with dark skin and short hair',
      'ID photo, plain light background, slight smile'
    ),
  },
  {
    file: 'portrait-05.jpg',
    width: 320,
    prompt: portrait(
      'woman in her forties wearing a white coat and stethoscope',
      'professional staff headshot, blurred clinic background'
    ),
  },
  {
    file: 'portrait-06.jpg',
    width: 320,
    prompt: portrait(
      'man in his sixties with East Asian features wearing scrubs',
      'professional staff headshot, studio lighting, gray backdrop'
    ),
  },
  {
    file: 'portrait-07.jpg',
    width: 320,
    prompt: portrait(
      'teenage girl with freckles and glasses',
      'candid photo outdoors, warm afternoon light'
    ),
  },
  {
    file: 'portrait-08.jpg',
    width: 320,
    prompt: portrait(
      'middle-aged man with a shaved head',
      'candid photo indoors, mixed lighting, looking slightly off camera'
    ),
  },
  {
    file: 'xray-chest.jpg',
    width: 512,
    prompt:
      'Synthetic posteroanterior chest X-ray radiograph, grayscale, normal anatomy, black background. No text, no letters, no markers, no labels.',
  },
  {
    file: 'skin-lesion.jpg',
    width: 512,
    prompt:
      'Dermatology documentation photograph: close-up of a small benign mole on the skin of a forearm, even clinical lighting, neutral background. No face, no text, no ruler.',
  },
] as const

const manifestSchema = z.array(
  z.object({
    file: z.string(),
    prompt: z.string(),
    model: z.string(),
    generated: z.string(),
  })
)

async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(root, { recursive: true })
  const manifestPath = join(root, 'manifest.json')
  const manifest = (await exists(manifestPath))
    ? manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
    : []

  for (const spec of assetSpecs) {
    const path = join(root, spec.file)
    if (await exists(path)) continue

    const started = performance.now()
    const { image, usage } = await generateImage({
      model,
      prompt: spec.prompt,
      size: '1024x1024',
      maxRetries: 0,
      providerOptions: { openai: { quality: 'low' } },
    })
    await writeFile(
      path,
      await sharp(image.uint8Array)
        .resize({ width: spec.width })
        .jpeg({ quality: 82 })
        .toBuffer()
    )

    manifest.push({
      file: spec.file,
      prompt: spec.prompt,
      model: model.modelId,
      generated: new Date().toISOString().slice(0, 10),
    })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    log.info(
      {
        file: spec.file,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        durationMs: Math.round(performance.now() - started),
      },
      'Generated asset'
    )
  }
}
