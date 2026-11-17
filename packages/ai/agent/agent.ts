import { defineAgent } from "eve"

export default defineAgent({
  model: "openai/gpt-6-sol",
  defaultTools: false,
  tool: false,
  reasoning: "low",
})
