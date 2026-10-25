import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUBBLE_SIZE_KEY, bubbleSize, limitBubbleSize, setBubbleSize, attachBubbleSizePreference } from '../src/client/bubble-size.js'

test('speech size persists independently; invalid values recover and screen changes limit display', () => {
  const previous = globalThis.window
  const store = new Map([['dsh-piggy:pig-size', 'scale:4']])
  globalThis.window = { innerWidth: 1280, innerHeight: 800, localStorage: {
    getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value),
  } }
  try {
    assert.equal(bubbleSize(), 1)
    assert.equal(setBubbleSize(2), 2)
    assert.equal(bubbleSize(), 2)
    assert.equal(store.get('dsh-piggy:pig-size'), 'scale:4')
    for (const invalid of ['NaN', 'Infinity', '0', '-5']) {
      store.set(BUBBLE_SIZE_KEY, invalid)
      assert.equal(bubbleSize(), 1)
    }
    const limited = limitBubbleSize(100, { width: 320, height: 600 })
    assert.ok(limited * 272 <= 320 - 24)
    assert.ok(limited * 208 <= 600 - 64)
  } finally { globalThis.window = previous }
})

test('other-window size changes apply immediately and detach on unmount', () => {
  const previous = globalThis.window
  const store = new Map()
  const listeners = new Map()
  globalThis.window = { innerWidth: 1280, innerHeight: 800,
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name) },
  }
  const properties = new Map()
  const host = { style: { getPropertyValue: key => properties.get(key) ?? '', setProperty: (key, value) => properties.set(key, value) } }
  let changes = 0
  try {
    const stop = attachBubbleSizePreference(host, () => { changes++ })
    assert.equal(properties.get('--bubble-scale'), '1')
    store.set(BUBBLE_SIZE_KEY, '2')
    listeners.get('storage')({ key: 'dsh-piggy:pig-size' })
    assert.equal(changes, 0)
    listeners.get('storage')({ key: BUBBLE_SIZE_KEY })
    assert.equal(properties.get('--bubble-scale'), '2')
    assert.equal(changes, 1)
    window.innerWidth = 320
    listeners.get('resize')()
    assert.ok(Number(properties.get('--bubble-scale')) < 2)
    assert.equal(store.get(BUBBLE_SIZE_KEY), '2', 'smaller display must not discard the saved preference')
    stop()
    assert.equal(listeners.size, 0)
  } finally { globalThis.window = previous }
})
