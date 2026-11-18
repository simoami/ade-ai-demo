import { logger } from '@repo/logger'

/** Pipeline step logger; import only from step bodies so the workflow bundle stays Node-free. */
export const log = logger.getSubLogger({ name: 'pipeline' })
