# Repository Guidelines

## Project Structure & Module Organization

`apps/web` is the Next.js App Router application (strict TypeScript, Tailwind v4). `packages/ui` exports shadcn components built on Base UI as `@repo/ui`; shared styles live in `src/styles/globals.css`. Keep UI primitives there and app routes in `apps/web/app`.

`packages/ai` (`@repo/ai`) owns the eve agent in `agent/`. Next.js uses `withEve` with `eveRoot: "../../packages/ai"` to start its service and proxy `/eve/v1/*`. Workflows and steps live in `src/workflows/ingest-document`; plain rendering logic lives in `src/stages/render`. Next.js calls the authenticated document channel through `apps/web/lib/server/pipeline-client.ts`.

The pnpm workspace and shared dependency catalog live in `pnpm-workspace.yaml`. Use `workspace:*` for internal dependencies and `catalog:` for shared versions. Node 26 and the pinned pnpm version in `package.json` are required. Run `nvm use` to select the version in `.nvmrc`.

## Build, test, and development commands

Run from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start the eve service (port 8000) and Next.js together through Turbo.
- `pnpm workflows`: open the Workflow inspector on eve's local run history (port 3456).
- `pnpm check:agent`: check agent health through the running web server at localhost:3000.
- `pnpm eval`: run eve evals once evaluation cases are added.
- `pnpm test`: run environment, service authentication, gateway, document contract and rendering tests.
- `pnpm workflows`: open the pinned Workflow inspector on eve local history.
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

This code is a portfolio piece that will be read as production code. Every change must hold up to a senior reviewer.

- Write the least code that fully solves the task. No speculative abstractions, unused exports, placeholder files, or "future-proofing".
- Prefer the platform and the chosen stack (Next.js, AI SDK, eve, Vercel primitives) over hand-rolled equivalents.
- Names carry meaning; comments explain _why_, never _what_. Delete commented-out code and scaffold leftovers (demo pages, sample assets, boilerplate READMEs).
- TypeScript is strict. No `any`, no non-null assertions without a reason in a comment, no `@ts-ignore`.
- Validate data at boundaries (uploads, model output, env vars) with schemas; trust types inside.
- Handle failures explicitly. Never swallow errors or log-and-continue silently.
- Treat all document content as PHI: never log raw text, never send it anywhere not named in the architecture.
- Code, comments and docs describe current behavior only. Keep implementation history in commit messages.
- Separate top-level declarations, and unrelated blocks inside a function, with a blank line. Keep tightly related lines together.
- Keep docs short, factual, and current. No marketing tone, emoji, or filler. Update this file when commands or layout change.
- Before finishing, run the relevant `build`, `typecheck`, and `lint` scripts and report their real output.

## Agent-Specific Instructions

For frontend library-selection work, consult `.agents/skills/pick-ui-library/SKILL.md` and honor its curated choices. Treat `skills-lock.json` as generated integrity metadata, not as the primary editing surface.

## Agent environment and runtime

Use `packages/ai/.env.example` and `apps/web/.env.example` for required variables.
The service requires `OPENAI_API_KEY`; local service calls require the same
`PIPELINE_SERVICE_SECRET` in both packages. Next.js validates the fixed
`PIPELINE_SERVICE_ORIGIN`. Startup rejects missing or blank credentials; builds
need none. Direct OpenAI model instances live in `packages/ai/src/models.ts`.

`agent/channels/documents.ts` authenticates with eve HTTP Basic locally and
Vercel OIDC on deployments before validating requests. Workflow API calls run
in eve. `agent/tools/ingest-document.ts` registers the imported workflow.
Default agent tools and trace emission are disabled.

See `packages/ai/README.md` for the separate local service and web startup
commands. `pnpm check:agent` checks health without a model request;
`bash scripts/smoke-review.sh` checks rendering, refresh and review completion.
`pnpm workflows` uses CLI 5.1.0, matching eve's Workflow dependencies; live
inspector compatibility requires verification against a running service.

Artifacts and run-ID mappings are stored under the OS temp directory. Only the
synthetic fixture is supported. Deployment requires durable artifact/run
metadata storage, custom-channel routing, Deployment Protection, and service
credentials. Keep document content out of logs and workflow history.
