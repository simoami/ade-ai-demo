import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logger } from '@repo/logger'
import { refresh } from '#workflows/ingest-document/steps/refresh.step'

const documentId = 'f5947cf9-48ef-4354-8c39-c1bba1444319'

test('records refresh counts without decision contents', async () => {
  const records: string[] = []
  const detach = logger.attachTransport({
    format: 'json',
    write: (_record, line) => {
      records.push(line)
    },
  })

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
    await logger.flush()
    assert.equal(records.length, 1)
    assert.ok(records[0]?.includes('Refresh completed'))
    assert.ok(
      !records.join('\n').includes('e85bbdcf-4795-4bf1-bf18-3306e56779d3')
    )
  } finally {
    detach()
  }
})
