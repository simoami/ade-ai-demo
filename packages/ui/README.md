# @repo/ui

Shared components built with shadcn on Base UI (`base-mira` style), plus the Tailwind v4 global stylesheet.

## Use

```ts
import "@repo/ui/globals.css"
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
```

The consuming Next.js app must list `@repo/ui` in `transpilePackages`.

## Adding components

Run the shadcn CLI from `apps/web`; its `components.json` points the aliases at this package, so new components land in `src/components`.

```sh
pnpm dlx shadcn@latest add dialog
```
