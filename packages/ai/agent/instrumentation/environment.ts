import { defineInstrumentation } from 'eve/instrumentation'
import { validateEnvironment } from '../lib/environment'

export default defineInstrumentation({
  tracePolicy: () => ({ emit: false }),
  setup() {
    validateEnvironment(process.env)
  },
})
