# Repository Guidelines

## Project Structure & Module Organization

`apps/web` is the Next.js App Router application (strict TypeScript, Tailwind v4). `packages/ui` exports shadcn components built on Base UI as `@repo/ui`; shared styles live in `src/styles/globals.css`. Keep UI primitives there, app routes in `apps/web/app`, and app components in `apps/web/components`. The screens read Postgres through `apps/web/lib/server/records.ts`. `pnpm --filter @repo/ai seed:samples` loads six synthetic fixtures (redacted pages to Blob, rows to Postgres); run it, and `pnpm --filter @repo/db db:migrate`, for each Neon branch a deployment uses.

`packages/ai` (`@repo/ai`) owns the eve agent in `agent/`. Local Next.js uses `withEve` with `eveRoot: "../../packages/ai"` to start its service and proxy `/eve/v1/*`. Root `vercel.ts` composes separate web and eve services; a private binding connects the document gateway to eve. Workflows and steps live in `src/workflows/ingest-document`; plain stages live in `src/stages/render`, `src/stages/ocr` (LLM, Datalab and Reducto OCR providers), `src/stages/pii` and `src/stages/redact`. Next.js calls the authenticated document channel through `apps/web/lib/server/pipeline-client.ts`.

`packages/logger` (`@repo/logger`) provides the shared tslog root and named sub-loggers, with nested sensitive-key masking. Output is pretty in development and JSON when `VERCEL=1` or `NODE_ENV=production`. Workflow milestones log inside durable steps.

The pnpm workspace and shared dependency catalog live in `pnpm-workspace.yaml`. Use `workspace:*` for internal dependencies and `catalog:` for shared versions. Node 26 and the pinned pnpm version in `package.json` are required. Run `nvm use` to select the version in `.nvmrc`.

## Build, test, and development commands

Run from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start the eve service (port 8000) and Next.js together through Turbo.
- `pnpm workflows`: open the Workflow inspector on eve's local run history (port 3456).
- `pnpm check:agent`: check agent health through the running web server at localhost:3000.
- `pnpm eval`: run Braintrust stage suites locally; upload synthetic results when `BRAINTRUST_API_KEY` is set.
- `pnpm eval:ocr` or `pnpm eval ocr`: run the OCR suite; `EVAL_OCR_PROVIDER` selects the provider arm.
- `pnpm test`: run environment, service authentication, gateway, document contract, rendering, OCR stage and scorer, and logger masking tests.
- `pnpm build`: build the agent, then the production web app.
- `pnpm lint`: run Biome lint with zero warnings allowed.
- `pnpm typecheck`: generate Next.js route types and check all packages.
- `pnpm format`: format workspace packages with Biome.
- `pnpm check`: check lint, formatting, and imports across the repository.

Turbo coordinates package tasks. Agent tests use Node’s built-in test runner.

## Coding Style & Naming Conventions

Use Biome with the checked-in configuration, single quotes, two-space indentation, descriptive kebab-case directory names, and Markdown headings in sentence case. Keep agent instructions direct, action-oriented, and colocated with the behavior they govern. Edit the canonical `.agents/skills/...` file rather than its `.claude/skills/...` symlink.

## Testing Guidelines

Node’s built-in test runner covers agent environment validation; no coverage threshold exists. New application logic should introduce automated tests in the same change. Name tests after observable behavior (for example, `selects-sonner-for-toast-task`) and include both the primary path and important failure cases.

## Commit & Pull Request Guidelines

Use concise imperative subjects with Conventional Commit prefixes such as `feat:`, `fix:`, or `docs:`. Do not add AI co-author or attribution trailers. Pull requests should explain the change and validation performed, link relevant issues, and include screenshots for visible UI changes. Keep generated lock data in the same commit as the skill change that produced it.

## Engineering standards

Hold every change to production standards.

- Write the least code that fully solves the task. No speculative abstractions, unused exports, placeholder files, or "future-proofing".
- Prefer the platform and the chosen stack (Next.js, AI SDK, eve, Vercel primitives) over hand-rolled equivalents.
- Names carry meaning; comments explain _why_, never _what_. Delete commented-out code and scaffold leftovers (demo pages, sample assets, boilerplate READMEs).
- TypeScript is strict. No `any`, no non-null assertions without a reason in a comment, no `@ts-ignore`.
- Validate data at boundaries (uploads, model output, env vars) with schemas; trust types inside.
- Handle failures explicitly. Never swallow errors or log-and-continue silently.
- Treat all document content as PHI: never log raw text, never send it anywhere not named in the architecture.
- Code, comments and docs describe current behavior only. Keep implementation history in commit messages.
- Separate top-level declarations, and unrelated blocks inside a function, with a blank line. Keep tightly related lines together.
- Give exported functions, classes and workflow, step and stage entries a JSDoc header of one to three lines saying what it is or guarantees. Skip `@param`/`@returns`. Add inline comments only where they explain a non-obvious why.
- Import across directories with Node subpath imports (`#...`, declared in each package's `imports`), never `../` paths or tsconfig `paths`.
- Log through `@repo/logger`, never `console`. Create sub-loggers at module scope (`const log = logger.getSubLogger({ name })`) and call `log.info(...)` in functions. Name sub-loggers after their file or function, using dots for nesting (`ingest-document.refresh`). Workflow step files are bundled into the sandboxed workflow driver, so a step creates its sub-logger on the first line of its `'use step'` body, not at module scope. Log milestones with IDs, counts, durations and statuses only.
- Keep docs short, factual, and current. No marketing tone, emoji, or filler. Update this file when commands or layout change.
- Before finishing, run the relevant `build`, `typecheck`, and `lint` scripts and report their real output.

## Agent-Specific Instructions

For frontend library-selection work, consult `.agents/skills/pick-ui-library/SKILL.md` and honor its curated choices. Treat `skills-lock.json` as generated integrity metadata, not as the primary editing surface.

## Agent environment and runtime

Use `packages/ai/.env.example` and `apps/web/.env.example` for required variables.
The service requires `OPENAI_API_KEY` and, for OCR, `REDUCTO_API_KEY`; local service calls require the same
`PIPELINE_SERVICE_SECRET` in both packages. Next.js validates the fixed
`PIPELINE_SERVICE_ORIGIN`, injected by the Vercel service binding at function runtime. Set it explicitly for local development. Local startup rejects missing or blank credentials; Vercel validates binding configuration on each gateway call. Builds need no credentials. Direct OpenAI model instances live in `packages/ai/src/models.ts`.

`agent/channels/documents.ts` authenticates with eve HTTP Basic locally and
Vercel OIDC on deployments before validating requests. Workflow API calls run
in eve. `agent/tools/ingest-document.ts` registers the imported workflow.
Default agent tools and trace emission are disabled.

See `packages/ai/README.md` for the separate local service and web startup
commands. `pnpm check:agent` checks health without a model request;
`pnpm workflows` uses CLI 5.1.0, matching eve's Workflow dependencies; live
inspector compatibility requires verification against a running service.

Page images load directly from private Blob through single-file GET-only signed
URLs (15 minutes), with separate full images and thumbnails and real page proportions.
`documents.page_version` selects versioned redacted pairs; null permits render pairs
only during `reading` and `redacting`. Serialize `publishRedactedPages` per document:
write all pairs, publish the version, then delete obsolete pages and renders.
Migration 0002 adds the nullable version; migrate and reseed each deployment branch.
Originals and internal renders live in private Blob; encrypted OCR uses
`DOCUMENT_ENCRYPTION_KEY` (base64, 32 bytes). Documents and run IDs live in
Postgres (`DATABASE_URL`). The workflow accepts uploaded PDFs or ordered
PNG/JPEG images, runs rendering, Reducto OCR, identifier detection, picture review and redaction,
then publishes burned pages and sets `needsReview`. The redaction step checkpoints
encrypted burned pages and a manifest before publication so retries can finish
after render deletion. It replaces redaction rows atomically using UUID v5 IDs. Rendering scratch directories are
removed inside the step. Terminal review writes status. The workspace Admin dialog offers synthetic
PDF downloads and an authenticated reset that cancels runs, removes document
Blobs and deletes document rows while preserving patients. Per-document
artifact cleanup is not implemented. Deployment requires Deployment Protection and service
credentials. Keep document content out of logs and OCR out of workflow history.
