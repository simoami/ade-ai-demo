# Clinical record ingestion

A pipeline that turns uploaded clinical records into redacted, patient-linked, reviewable data. It reads each document with OCR, redacts direct identifiers in the page images, extracts observations with source citations, and indexes clinical notes for semantic search. A person reviews the result before it is locked, and a page-aware assistant answers questions about the records with page citations.

Built on Next.js, the AI SDK, eve, Vercel Workflow, Vercel Blob and Neon Postgres with pgvector. Model-backed stages are developed against evaluation datasets first.

## Documentation

- [Architecture](docs/architecture.md): pipeline, review loop, privacy, data model, evaluation
- [Domain language](CONTEXT.md)
- [Decision records](docs/adr)
- [Contributor and agent guidelines](AGENTS.md)

## Layout

| Path          | Package    | Purpose                                                     |
| ------------- | ---------- | ----------------------------------------------------------- |
| `apps/web`    | `web`      | Next.js app                                                 |
| `packages/ai` | `@repo/ai` | eve service, render workflow, OCR stage and synthetic evals |
| `packages/ui` | `@repo/ui` | Shared shadcn components on Base UI                         |

## Requirements

- Node 26 (`nvm use` reads `.nvmrc`)
- pnpm 12, pinned in `package.json`

## Getting started

```sh
nvm use
pnpm install
cp packages/ai/.env.example packages/ai/.env.local   # then fill in credentials
cp apps/web/.env.example apps/web/.env.local         # same PIPELINE_SERVICE_SECRET
pnpm dev
```

Open http://localhost:3000. `pnpm check:agent` confirms the agent service is reachable.

## Commands

Run from the repository root.

| Command          | Does                                                      |
| ---------------- | --------------------------------------------------------- |
| `pnpm dev`       | Start the agent service and the web app                   |
| `pnpm workflows` | Open the Workflow run inspector                           |
| `pnpm build`     | Build the agent, then the web app                         |
| `pnpm test`      | Run unit tests                                            |
| `pnpm eval`      | Run Braintrust stage evals                                |
| `pnpm typecheck` | Type-check every package                                  |
| `pnpm lint`      | Lint with Biome, warnings fail                            |
| `pnpm format`    | Format with Biome                                         |
| `pnpm check`     | Lint, format and import-order check across the repository |

OCR runs independently of the review workflow. `pnpm eval:ocr` evaluates both
variants of 16 synthetic fixtures; see [the scorecard](docs/evals.md).
Regenerate fixtures with `node packages/ai/scripts/generate-synthetic.ts`.
