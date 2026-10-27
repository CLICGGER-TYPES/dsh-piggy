import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bindStageEvents } from '../src/client/stage-events.js'

function setup() {
  const listeners = new Map()
  const doc = { activeElement: null, layers: [], querySelectorAll() { return this.layers },
    addEventListener(k, fn) { listeners.set('doc:' + k, fn) }, removeEventListener(k, fn) { assert.equal(listeners.get('doc:' + k), fn); listeners.delete('doc:' + k) } }
  const target = { document: doc, getComputedStyle: el => ({ visibility: el.visibility ?? 'visible' }),
    addEventListener(k, fn) { listeners.set(k, fn) }, removeEventListener(k, fn) { assert.equal(listeners.get(k), fn); listeners.delete(k) } }
  const ctx = { isOpen: true }
  const closes = []
  const off = bindStageEvents(target, ctx, value => closes.push(value), () => {}, () => {})
  const fire = changes => { const event = { key: 'Escape', repeat: false, defaultPrevented: false, target: null,
    preventDefault() { this.defaultPrevented = true }, stopImmediatePropagation() { this.stopped = true }, ...changes }
    listeners.get('keydown')(event); return event }
  return { doc, ctx, closes, off, fire, listeners }
}

test('stage Escape closes an open menu and consumes the key, independent of blur preferences', () => {
  const s = setup()
  const event = s.fire({})
  assert.deepEqual(s.closes, [false])
  assert.equal(event.defaultPrevented, true)
  assert.equal(event.stopped, true)
  s.ctx.isOpen = false
  s.fire({})
  assert.equal(s.closes.length, 1)
  s.off()
  assert.equal(s.listeners.size, 0)
})

test('stage Escape preserves editable controls and visible inner dialogs', () => {
  const s = setup()
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) s.fire({ target: { tagName } })
  s.fire({ target: { parentElement: { isContentEditable: true } } })
  s.fire({ repeat: true })
  s.fire({ defaultPrevented: true })
  s.doc.activeElement = { tagName: 'INPUT' }
  s.fire({})
  s.doc.activeElement = null
  s.doc.layers = [{ getClientRects: () => [{}] }]
  s.fire({})
  assert.deepEqual(s.closes, [])
  s.doc.layers[0].visibility = 'hidden'
  s.fire({})
  assert.deepEqual(s.closes, [false])
  s.off()
})
