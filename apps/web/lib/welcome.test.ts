import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dismissWelcome, shouldShowWelcome } from './welcome.ts'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

test('shows welcome by default and persists only an explicit opt-out', () => {
  const saved = storage()
  assert.equal(
    shouldShowWelcome(() => saved),
    true
  )
  dismissWelcome(() => saved, true)
  assert.equal(
    shouldShowWelcome(() => saved),
    true
  )
  dismissWelcome(() => saved, false)
  assert.equal(saved.getItem('ade.welcome.dismissed'), '1')
  assert.equal(
    shouldShowWelcome(() => saved),
    false
  )
  dismissWelcome(() => saved, true)
  assert.equal(
    shouldShowWelcome(() => saved),
    true
  )
})

test('shows and dismisses welcome when browser storage access throws', () => {
  const blocked = () => {
    throw new Error('Storage unavailable')
  }
  assert.equal(shouldShowWelcome(blocked), true)
  assert.doesNotThrow(() => dismissWelcome(blocked, false))
  assert.doesNotThrow(() => dismissWelcome(blocked, true))
})
