import { defineConfig } from 'drizzle-kit'
import { readDatabaseUrl } from '#env'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  ...(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
    ? {
        dbCredentials: {
          url: readDatabaseUrl(
            process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
          ),
        },
      }
    : {}),
})
