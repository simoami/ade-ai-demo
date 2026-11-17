# @repo/ai

The eve agent service, and the future home of the ingestion pipeline, its prompts and model registry, and its evals. Keeping AI workloads here lets any app reuse them.

## Layout

| Path                     | Contents                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| `agent/agent.ts`         | Agent definition: model, tools, reasoning effort                        |
| `agent/instructions.md`  | System instructions                                                     |
| `agent/instrumentation/` | Startup environment check and OpenTelemetry policy (trace emission off) |
| `agent/lib/`             | Shared helpers                                                          |
| `tests/`                 | Node test runner tests                                                  |

## Environment

Copy `.env.example` to `.env.local`. Startup fails if no model credential is set; builds need none.

## Commands

| Command        | Does                                  |
| -------------- | ------------------------------------- |
| `pnpm dev:eve` | Run the agent without the terminal UI |
| `pnpm build`   | Build the agent with `eve build`      |
| `pnpm test`    | Run tests                             |
| `pnpm eval`    | Run `eve eval`                        |

The web app starts this service automatically in development through `withEve`.
