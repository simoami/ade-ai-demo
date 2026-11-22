import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uploadError } from '#lib/upload'

const pdf = {
  name: 'record.pdf',
  type: 'application/pdf',
  size: 20 * 1024 * 1024,
}

const png = { name: 'scan.png', type: 'image/png', size: pdf.size }

test('accepts PDFs, PNGs and JPEGs in mixed selections with per-file limits', () => {
  assert.equal(uploadError([pdf]), null)
  assert.equal(uploadError([pdf, png, { ...png, type: 'image/jpeg' }]), null)
  assert.equal(uploadError(Array(10).fill(pdf)), null)
})

test('names unsupported files and their types, including missing types', () => {
  assert.match(
    uploadError([{ ...pdf, type: 'text/plain' }]) ?? '',
    /record.pdf.*text\/plain/
  )
  assert.match(uploadError([{ ...png, type: '' }]) ?? '', /scan.png.*unknown/)
})

test('rejects oversized files, empty selections and more than ten files', () => {
  assert.match(
    uploadError([pdf, { ...png, size: png.size + 1 }]) ?? '',
    /scan.png.*20 MB/
  )
  assert.match(uploadError([]) ?? '', /Choose a file/)
  assert.match(uploadError(Array(11).fill(png)) ?? '', /at most 10 files/)
})
