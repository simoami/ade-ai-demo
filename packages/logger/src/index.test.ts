import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logger } from './index.ts'

const keys = [
  'authorization',
  'password',
  'secret',
  'token',
  'apiKey',
  'text',
  'content',
  'name',
  'firstName',
  'lastName',
  'mrn',
  'dob',
  'dateOfBirth',
  'address',
  'phone',
  'email',
]

for (const format of ['json', 'pretty'] as const) {
  test(`masks sensitive values in nested objects and arrays in ${format} output`, async () => {
    const lines: string[] = []
    const log = logger.getSubLogger({ name: 'mask-test', type: 'hidden' })
    log.attachTransport({
      format,
      write: (_record, line) => {
        lines.push(line)
      },
    })
    const sensitive = Object.fromEntries(
      keys.flatMap((key) => [
        [key, `private-${key}`],
        [key.toUpperCase(), `private-upper-${key}`],
      ])
    )

    log.info(
      {
        documentId: 'fake-document-id',
        ...sensitive,
        nested: { ...sensitive, items: [sensitive] },
      },
      'Test milestone'
    )
    await log.flush()

    assert.equal(lines.length, 1)
    const output = lines.join('\n')
    for (const key of keys) {
      assert.ok(!output.includes(`private-${key}`), key)
      assert.ok(!output.includes(`private-upper-${key}`), key)
    }
    assert.ok(output.includes('[***]'))
    assert.ok(output.includes('fake-document-id'))
    assert.ok(output.includes('Test milestone'))
    assert.equal(sensitive.password, 'private-password')
  })
}
