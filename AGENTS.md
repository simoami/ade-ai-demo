# Repository Guidelines

## Project Structure & Module Organization

`apps/web` is the Next.js App Router application (strict TypeScript, Tailwind v4). `packages/ui` exports shadcn components built on Base UI as `@repo/ui`; shared styles live in `src/styles/globals.css`. Keep UI primitives there and app routes in `apps/web/app`.

`packages/ai` (`@repo/ai`) owns the eve agent in `agent/`. Next.js uses `withEve` with `eveRoot: "../../packages/ai"` to start its service and proxy `/eve/v1/*`. Keep pipeline code in that package.

The pnpm workspace and shared dependency catalog live in `pnpm-workspace.yaml`. Use `workspace:*` for internal dependencies and `catalog:` for shared versions. Node 26 and the pinned pnpm version in `package.json` are required. Run `nvm use` to select the version in `.nvmrc`.

## Build, test, and development commands

Run from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start Next.js through Turbo; `withEve` starts the agent service on demand.
- `pnpm dev:eve`: run the agent alone without the TUI or development extensions.
- `pnpm check:agent`: check agent health through the running web server at localhost:3000.
- `pnpm eval`: run eve evals once evaluation cases are added.
- `pnpm test`: run automated tests (currently credential validation).
- `pnpm build`: build the agent, then the production web app.
- `pnpm lint`: run Biome lint with zero warnings allowed.
- `pnpm typecheck`: generate Next.js route types and check all packages.
- `pnpm format`: format workspace packages with Biome.
- `pnpm check`: check lint, formatting, and imports across the repository.

Turbo coordinates package tasks. Agent tests use Node’s built-in test runner.

## Coding Style & Naming Conventions

Use Biome with the checked-in configuration, two-space indentation, descriptive kebab-case directory names, and Markdown headings in sentence case. Keep agent instructions direct, action-oriented, and colocated with the behavior they govern. Edit the canonical `.agents/skills/...` file rather than its `.claude/skills/...` symlink.

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
- Keep docs short, factual, and current. No marketing tone, emoji, or filler. Update this file when commands or layout change.
- Before finishing, run the relevant `build`, `typecheck`, and `lint` scripts and report their real output.

## Agent-Specific Instructions

For frontend library-selection work, consult `.agents/skills/pick-ui-library/SKILL.md` and honor its curated choices. Treat `skills-lock.json` as generated integrity metadata, not as the primary editing surface.

## Agent environment and runtime

Use `packages/ai/.env.example` as the variable list. Set either
`AI_GATEWAY_API_KEY` (Vercel AI Gateway key) or `VERCEL_OIDC_TOKEN` (Vercel project
OIDC credential) in `packages/ai/.env.local` or the process environment; omit the
unused variable. Startup rejects missing or blank credentials. Builds need no
credential. The model is `openai/gpt-6-sol`, routed through AI Gateway.

The built-in eve channel permits local development and Vercel OIDC callers.
Optional tools and trace emission are disabled. No ingestion steps exist yet.
`pnpm check:agent` calls the public health route without a model request; local
`POST /eve/v1/session` with `{"message":"Report readiness without patient data."}`
exercises a model turn once real credentials are supplied.

For Vercel, configure the monorepo build command as `pnpm build` and Next.js output
as `apps/web/.next`; `withEve` contributes the agent service. Supply credentials in
the deployment environment. No deployment was performed by the wiring task.
