# web

The Next.js App Router application exposes document start, status and review
routes. They validate the shared `@repo/ai/review-action` contract and call eve
through `lib/server/pipeline-client.ts`, which applies service authentication,
a fixed origin, a timeout, response validation and safe HTTP errors.

Copy `.env.example` to `.env.local` and set DATABASE_URL, the private Blob token
and the shared service credential.
See [the service README](../../packages/ai/README.md) for local startup commands.
On Vercel the client sends the project's OIDC token instead of Basic credentials.

`next.config.ts` uses `withEve` for `/eve/v1/*` protocol routing. Document calls
use `PIPELINE_SERVICE_ORIGIN`; no custom rewrite is configured. Components come
from `@repo/ui`.

Run `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, or `pnpm test` here.
`pnpm check:agent` checks the agent health route through the running web server.

Server library imports use `#lib/*` → `./lib/*.ts` in `package.json`.
The pipeline client logs failures through `@repo/logger` with a service path,
status and error type only. Upstream bodies and error messages are never logged.
Next.js transpiles the shared logger and document contract source packages.

Screens read documents, patients, redactions and observations directly from Postgres
through `lib/server/records.ts`. Only match results and limited demographics reach
the browser. Processing documents refresh every three seconds. Review decisions
remain local client state.

Uploads go directly to private Blob through `@repo/storage/client`, then start one
document via `/api/documents`. The file endpoint serves only
`documents/<uuid>/pages/<positive integer>.webp`; originals, renders and OCR artifacts
are inaccessible through it. API handler tests run alongside library tests.
