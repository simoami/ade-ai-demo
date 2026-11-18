import { defineAgent } from 'eve'
import { models } from '../src/models'

export default defineAgent({
  model: models.pipeline,
  defaultTools: false,
  tool: false,
  reasoning: 'low',
})
