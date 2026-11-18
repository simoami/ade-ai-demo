import { defineAgent } from 'eve'
import { models } from '#models'

/** Configures the pipeline agent without default tools. */
export default defineAgent({
  model: models.pipeline,
  defaultTools: false,
  tool: false,
  reasoning: 'low',
})
