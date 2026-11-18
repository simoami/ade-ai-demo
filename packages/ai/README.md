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
app together. With both running, `bash scripts/smoke-review.sh` exercises a review.

`EVE_BASE_URL` tells `withEve` to reuse this service for protocol routes instead
of starting its own; the document client uses `PIPELINE_SERVICE_ORIGIN`. No document
rewrite is installed. The smoke script renders, submits a redaction decision,
completes review, and checks the final status and counter without a model call.

`POST /api/documents` accepts `{"fixtureId":"clinical-20"}` or `{}`. Artifacts
and run-ID mappings are written under `<os-temp>/ade-documents/<documentId>/`.
Local Workflow history lives in `packages/ai/.eve/.workflow-data`. Artifacts
are not encrypted or automatically deleted; only the synthetic fixture is
supported. Deployment requires durable artifacts and document/run metadata,
custom-channel routing to the eve service, and Deployment Protection.

`pnpm --filter @repo/ai bench:render` measures rendering of the 20-page fixture
at 144 DPI with 240-pixel WebP thumbnails. Regenerate the fixture with
`node packages/ai/scripts/generate-synthetic.ts`.

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
rejections and request failures. Steps log render totals, refresh counts and
terminal review status; the workflow body has no logging side effects.
Only metadata is logged; errors contribute their type, never their message.
See [the logger README](../logger/README.md) for formatting and masked keys.
