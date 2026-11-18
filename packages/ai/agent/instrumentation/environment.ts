import { defineInstrumentation } from 'eve/instrumentation'
import { validateEnvironment } from '#agent/lib/environment'

/** Validates service configuration and disables trace emission. */
export default defineInstrumentation({
  tracePolicy: () => ({ emit: false }),
  setup() {
    validateEnvironment(process.env)
  },
})
