import { otel } from 'eve/instrumentation/otel'

/** Disables OpenTelemetry trace emission for document processing. */
export default otel({
  tracePolicy: () => ({ emit: false }),
})
