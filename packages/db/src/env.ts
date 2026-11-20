import { z } from 'zod'

const databaseUrlSchema = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine((value) => {
    const url = URL.parse(value)
    return Boolean(url?.hostname && url.username && url.pathname.length > 1)
  })

/** Validates credentials only on demand and never includes their values in errors. */
export function readDatabaseUrl(value = process.env.DATABASE_URL): string {
  const result = databaseUrlSchema.safeParse(value)

  if (!result.success) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL')
  }

  return result.data
}
