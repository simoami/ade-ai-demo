import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uploadError } from './upload.ts'

const pdf = { type: 'application/pdf', size: 1000 }

const png = { type: 'image/png', size: 1000 }

test('accepts one PDF or up to 30 images', () => {
  assert.equal(uploadError([pdf]), null)
  assert.equal(uploadError(Array(30).fill(png)), null)
})

test('rejects mixed, oversized, empty and too-long selections', () => {
  assert.match(uploadError([pdf, png]) ?? '', /one PDF/)
  assert.match(uploadError([pdf, pdf]) ?? '', /one PDF/)
  assert.match(uploadError(Array(31).fill(png)) ?? '', /at most 30/)
  assert.match(uploadError([{ ...pdf, size: 21 * 1024 * 1024 }]) ?? '', /20 MB/)
  assert.match(uploadError([]) ?? '', /Choose a file/)
})
