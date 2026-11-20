# @repo/ai

The eve service owns document ingestion. `agent/tools/ingest-document.ts`
registers the `ingest-document` tool; its imported workflow and durable steps
live under `src/workflows/ingest-document`. Ordinary rendering functions and
their tests live under `src/stages/render`. The only package export is the
shared document contract. `src/models.ts` creates direct OpenAI model instances.

Next.js calls `/pipeline/documents` on the configured service origin; only eve
calls `start`, `getRun` and `resumeHook`. The channel uses eve's documented
`httpBasic` authenticator (constant-time password comparison) locally and
`vercelOidc` on Vercel, before validating requests.

Set `OPENAI_API_KEY` and a shared `PIPELINE_SERVICE_SECRET` of at least 32
characters in this package's `.env.local`; copy `apps/web/.env.example` to
`apps/web/.env.local` and set the same secret.
Startup validates environment variables without printing values. On Vercel,
OIDC replaces the shared secret and eve requires `VERCEL_PROJECT_ID`.

`pnpm dev` from the repository root starts this service on port 8000 and the web
app together.

`EVE_BASE_URL` tells `withEve` to reuse this service for protocol routes instead
of starting its own; the document client uses `PIPELINE_SERVICE_ORIGIN`.
On Vercel, root `vercel.ts` binds the web service to eve privately and injects
`PIPELINE_SERVICE_ORIGIN`; the document channel has no public route. The Vercel
project Root Directory must be the repository root. Service bindings skip
Deployment Protection for internal calls; no automation bypass secret is needed.
OIDC still authenticates every channel request. Binding URLs are validated when
the gateway handles a request because bindings are unavailable during builds.

`POST /api/documents` accepts `{ fileName, pathnames }` after client uploads to
private Blob under `uploads/`. Supply one PDF or 1–30 PNG/JPEG images in page
order, up to 20 MB total. The channel inserts a Postgres document, starts its
workflow and stores `run_id`. Status and review requests look up that row.

Rendering uses a private, short-lived scratch directory removed after the step.
Unredacted renders are stored only at `documents/<id>/render/<page>.png`.
Reducto r-1 reads these pages; AES-256-GCM protects the OCR JSON at
`documents/<id>/ocr.json.enc` (12-byte IV, 16-byte auth tag, ciphertext).
Set `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `REDUCTO_API_KEY`, and
`DOCUMENT_ENCRYPTION_KEY` (base64, exactly 32 bytes) in the service environment.
Builds need no credentials. Tests replace storage, database and OCR operations.

Database status advances from `rendering` to `reading` to `redacting`, where it
stays pending the redaction stage. Processing failures write `failed` and fail
the workflow with a content-free error. The review hook records terminal
`reviewed` or `discarded` decisions. `redaction.update` currently increments a
refresh counter only. Terminal review does not yet delete artifacts. Real
uploads produce no redacted, servable `pages/<page>.webp` images in this step.
Workflow history includes original upload references and file names as input;
OCR content remains inside steps and encrypted Blob storage. Local Workflow
history lives in `packages/ai/.eve/.workflow-data`.

`pnpm --filter @repo/ai bench:render` measures rendering of the 20-page fixture
at 144 DPI with 240-pixel WebP thumbnails, using
`fixtures/synthetic/clinical-20/clean.pdf`. Regenerate all 16 fixture pairs with
`node packages/ai/scripts/generate-synthetic.ts`. Fixture images live in
`fixtures/assets`; `node --env-file=packages/ai/.env.local packages/ai/scripts/generate-assets.ts`
generates only missing images with OpenAI's image model and records each
prompt in `fixtures/assets/manifest.json`.

`pnpm workflows` opens the Workflow inspector using pinned `@workflow/cli@5.1.0`,
whose core 5.5.0 and local world 5.3.0 match eve 1.0.0. From the repository root:

```sh
WORKFLOW_TARGET_WORLD=local WORKFLOW_LOCAL_DATA_DIR=packages/ai/.eve/.workflow-data pnpm dlx @workflow/cli@5.1.0 inspect runs --web
```

The inspector's live access to eve data needs verification against a running
local service; package compatibility alone does not establish runtime behavior.

Internal imports use `#*` → `./src/*.ts` and `#agent/*` → `./agent/*.ts`
in `package.json`; callers omit the `.ts` extension. Node strip-types tests,
TypeScript and eve resolve the same source files without tsconfig aliases.

`@repo/logger` records run starts, accepted review actions, authentication
rejections and request failures. Steps log render/OCR totals, refresh counts and
terminal review status; the workflow body has no logging side effects.
Only metadata is logged; errors contribute their type, never their message.
See [the logger README](../logger/README.md) for formatting and masked keys.

## OCR and evaluation

`src/stages/ocr` transcribes PNG pages with at most two calls in flight. The
ingestion workflow uses the default Reducto r-1 provider; evaluations can
select a different provider.
`pnpm eval` runs the Braintrust stage suites; `pnpm eval:ocr` selects OCR.
Set `BRAINTRUST_API_KEY` in this package's `.env.local` to upload synthetic
experiments; without it, results remain local. `OPENAI_API_KEY` is required.
See [eval operation](evals/README.md) and [scores](../../docs/evals.md).
