import assert from 'node:assert/strict'
import { test } from 'node:test'
import { htmlText } from '#stages/ocr/html-text'

test('keeps table cells and rows apart and decodes entities', () => {
  assert.equal(
    htmlText(
      '<table><tr><th>Test</th><th>Flag</th></tr><tr><td>Glucose</td><td>H &amp; L</td></tr></table>'
    ),
    'Test Flag \nGlucose H & L'
  )
  assert.equal(htmlText('<b>Chart</b><br/>copy'), 'Chart\ncopy')
})
