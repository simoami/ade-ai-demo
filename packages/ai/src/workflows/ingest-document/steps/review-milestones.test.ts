import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logger } from '@repo/logger'

const records: string[] = []

// Sub-loggers copy transports when created, so capture must start before the steps load.
const detach = logger.attachTransport({
  format: 'json',
  write: (_record, line) => {
    records.push(line)
  },
})

const { complete } = await import('./complete.step.ts')
const { refresh } = await import('./refresh.step.ts')

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

test('records refresh counts and both terminal review statuses without decision contents', async () => {
  try {
    assert.equal(
      await refresh(
        documentId,
        {
          type: 'redaction.update',
          redactionId: 'e85bbdcf-4795-4bf1-bf18-3306e56779d3',
          status: 'accepted',
        },
        2
      ),
      3
    )
    for (const status of ['reviewed', 'discarded'] as const) {
      assert.deepEqual(await complete(documentId, status, 3), {
        documentId,
        status,
        refreshCount: 3,
      })
    }

    await logger.flush()
    assert.equal(records.length, 3)
    assert.ok(records[0]?.includes('Refresh completed'))
    assert.ok(records[1]?.includes('reviewed'))
    assert.ok(records[2]?.includes('discarded'))
    assert.ok(
      !records.join('\n').includes('e85bbdcf-4795-4bf1-bf18-3306e56779d3')
    )
  } finally {
    detach()
  }
})
