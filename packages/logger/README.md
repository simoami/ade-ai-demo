# @repo/logger

Shared server logger backed by tslog 5.5.0. Import `logger` and use
`logger.getSubLogger({ name: 'pipeline' })` for a named child; children inherit
formatting and masking.

```ts
import { logger } from '@repo/logger'

const log = logger.getSubLogger({ name: 'pipeline' })
log.info({ documentId, pageCount, durationMs }, 'Render completed')
```

Output is JSON when `VERCEL=1` or `NODE_ENV=production`, and pretty otherwise.

Built-in case-insensitive key masking covers nested objects and arrays:
`authorization`, `password`, `secret`, `token`, `apiKey`, `text`, `content`,
`name`, `firstName`, `lastName`, `mrn`, `dob`, `dateOfBirth`, `address`, `phone`,
`email`. Masking uses tslog v5's `mask.keys` setting.

All document content is PHI. Log IDs, counts, durations and statuses only.
Failure logs may include a fixed route path and error type, never an error
object, message, stack, request body or credentials. Masking is a backstop;
it cannot make arbitrary text safe to log. Workflow logs run inside steps,
which can retry, so a milestone may appear again after a failed attempt.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint` or `pnpm format` here.
