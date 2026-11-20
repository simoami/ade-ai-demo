import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { createDb } from '#client'
import { readDatabaseUrl } from '#env'

test('accepts PostgreSQL connection URLs', () => {
  for (const protocol of ['postgres', 'postgresql']) {
    const url = `${protocol}://demo:synthetic@localhost/demo?sslmode=require`
    assert.equal(readDatabaseUrl(url), url)
  }
})

test('rejects missing, blank, malformed and non-PostgreSQL URLs without exposing credentials', () => {
  for (const value of [
    '',
    ' ',
    'malformed',
    'https://demo:synthetic@localhost/demo',
    'postgresql://localhost/',
  ]) {
    assert.throws(() => readDatabaseUrl(value), {
      message: 'DATABASE_URL must be a PostgreSQL connection URL',
    })
  }
})

test('imports without credentials and rejects missing DATABASE_URL only when creating the client', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict'
    const { createDb } = await import('./src/index.ts')
    delete process.env.DATABASE_URL
    assert.throws(() => createDb(), { message: 'DATABASE_URL must be a PostgreSQL connection URL' })
  `,
    ],
    {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
    }
  )

  assert.equal(result.status, 0, result.stderr)
})

test('creates a typed client without making a network request', () => {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://demo:synthetic@localhost/demo'

  try {
    const db = createDb()
    assert.ok(db.query.documents)
    assert.ok(db.query.noteChunks)
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previous
    }
  }
})
