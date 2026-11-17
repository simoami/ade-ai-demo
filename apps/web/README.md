# web

The Next.js App Router application. It will host the documents and patients views, document review, the chat drawer, and the upload route; today it renders a placeholder page.

`next.config.ts` wraps the config with eve's `withEve`, which starts the agent service from `packages/ai` and proxies `/eve/v1/*` to it. Components come from `@repo/ui`, which is transpiled by Next.js.

## Commands

| Command            | Does                                                     |
| ------------------ | -------------------------------------------------------- |
| `pnpm dev`         | Start the dev server on port 3000                        |
| `pnpm build`       | Production build                                         |
| `pnpm typecheck`   | Generate route types, then type-check                    |
| `pnpm check:agent` | Call the agent's health route through the running server |

Run them from the repository root through Turbo, or here with `pnpm --filter web <command>`.
