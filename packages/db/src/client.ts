import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { readDatabaseUrl } from '#env'
import * as schema from '#schema'

/** Creates a Neon HTTP client, validating DATABASE_URL at first use rather than import. */
export function createDb() {
  return drizzle(neon(readDatabaseUrl()), { schema })
}
