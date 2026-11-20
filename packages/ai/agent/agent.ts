import { createRequire } from 'node:module'
import { defineAgent } from 'eve'
import { models } from '#models'

const require = createRequire(import.meta.url)

/** Configures the pipeline agent without default tools. */
export default defineAgent({
  model: models.pipeline,
  defaultTools: false,
  tool: false,
  reasoning: 'low',
  build: {
    // Nitro needs absolute binary paths; Tesseract's Node adapter selects a core by CPU features.
    externalDependencies: [
      'tesseract.js',
      'tesseract.js/src/worker-script/node/index.js',
      require.resolve('@tesseract.js-data/eng/4.0.0/eng.traineddata.gz'),
      ...['', '-simd', '-relaxedsimd'].map((variant) =>
        createRequire(require.resolve('tesseract.js')).resolve(
          `tesseract.js-core/tesseract-core${variant}.wasm`
        )
      ),
    ],
  },
})
