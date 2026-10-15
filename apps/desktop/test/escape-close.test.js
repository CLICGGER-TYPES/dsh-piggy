import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

const SOURCE = readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8')

function harness(role, initial = {}) {
  const calls = []
  const listeners = []
  const layers = []
  const petHost = initial.petPanelOpen === undefined ? null : {
    getAttribute(name) { return name === 'data-panel-open' ? String(initial.petPanelOpen) : null },
  }
  const document = {
    activeElement: null,
    addEventListener(type, listener, capture) { if (type === 'keydown') listeners.push({ listener, capture: capture === true, owner: 'preload' }) },
    querySelector(selector) { return selector === '[data-dsh-pig][data-panel-open="true"]' && initial.petPanelOpen ? petHost : null },
    querySelectorAll(selector) {
      assert.equal(selector, '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-farm-overlay]')
      return layers
    },
    defaultView: { getComputedStyle: node => ({ visibility: node.visibility ?? 'visible' }) },
  }
  runInNewContext(SOURCE, {
    document,
    process: { argv: role === 'pet' ? [] : ['--piggy-role=' + role] },
    require(name) {
      assert.equal(name, 'electron')
      return {
        contextBridge: { exposeInMainWorld() {} },
        ipcRenderer: { send(channel) { calls.push(channel) }, sendSync() {}, on() {}, invoke() {} },
      }
    },
  })

  function addFarmEscapeListener() {
    listeners.push({
      owner: 'farm', capture: false,
      listener(event) {
        if (event.key !== 'Escape') return
        const layer = layers.find(item => item.kind === 'dialog' || item.kind === 'farm-overlay')
        if (layer) {
          layer.dismissed = true
          layers.splice(layers.indexOf(layer), 1)
        }
      },
    })
  }
  function layer(kind, { rects = 1, visibility = 'visible' } = {}) {
    const node = { kind, visibility, dismissed: false, getClientRects: () => Array(rects).fill({}) }
    layers.push(node)
    return node
  }
  function key(key, options = {}) {
    const event = {
      key,
      repeat: options.repeat === true,
      target: options.target ?? { tagName: 'BODY', getAttribute: () => null },
      defaultPrevented: false,
      stopped: false,
      preventDefault() { this.defaultPrevented = true },
      stopImmediatePropagation() { this.stopped = true },
    }
    for (const { listener } of listeners) {
      listener(event)
      if (event.stopped) break
    }
    return event
  }
  return { calls, listeners, layer, addFarmEscapeListener, key, document }
}

test('panel Escape closes via the existing IPC; other keys do nothing', () => {
  const ui = harness('panel')
  const other = ui.key('Enter')
  assert.deepEqual(ui.calls, [])
  assert.equal(other.defaultPrevented, false)
  const escape = ui.key('Escape')
  assert.deepEqual(ui.calls, ['piggy:panel:close'])
  assert.equal(escape.defaultPrevented, true)
  assert.equal(escape.stopped, true)
})

test('pet focus closes only an open panel; a closed pet remains untouched', () => {
  const open = harness('pet', { petPanelOpen: true })
  open.key('Escape')
  assert.deepEqual(open.calls, ['piggy:panel:close'])

  const closed = harness('pet', { petPanelOpen: false })
  const event = closed.key('Escape')
  assert.deepEqual(closed.calls, [])
  assert.equal(event.defaultPrevented, false)
  assert.equal(event.stopped, false)
})

test('ext Escape closes through ext IPC, leaving main-process return-to-panel behavior intact', () => {
  const ui = harness('ext')
  ui.key('Escape')
  assert.deepEqual(ui.calls, ['piggy:ext:close'])
})

test('two farm layers consume successive Escapes before panel/ext close', () => {
  for (const role of ['panel', 'ext']) {
    const ui = harness(role)
    const dialog = ui.layer('dialog')
    const popup = ui.layer('farm-overlay')
    ui.addFarmEscapeListener()

    const first = ui.key('Escape')
    assert.equal(dialog.dismissed, true, role + ': first Escape cancels dialog')
    assert.equal(popup.dismissed, false)
    assert.deepEqual(ui.calls, [])
    assert.equal(first.defaultPrevented, false)

    ui.key('Escape')
    assert.equal(popup.dismissed, true, role + ': second Escape dismisses popup')
    assert.deepEqual(ui.calls, [])

    ui.key('Escape')
    assert.deepEqual(ui.calls, [role === 'panel' ? 'piggy:panel:close' : 'piggy:ext:close'])
  }
})

test('hidden and visibility-hidden layers do not block closing', () => {
  const noRect = harness('panel')
  noRect.layer('dialog', { rects: 0 })
  noRect.key('Escape')
  assert.deepEqual(noRect.calls, ['piggy:panel:close'])

  const invisible = harness('panel')
  invisible.layer('dialog', { visibility: 'hidden' })
  invisible.key('Escape')
  assert.deepEqual(invisible.calls, ['piggy:panel:close'])
})

test('visible dialog or farm popup gets Escape before native close', () => {
  for (const kind of ['dialog', 'farm-overlay']) {
    const ui = harness('ext')
    const active = ui.layer(kind)
    ui.addFarmEscapeListener()
    const event = ui.key('Escape')
    assert.equal(active.dismissed, true)
    assert.equal(event.defaultPrevented, false)
    assert.deepEqual(ui.calls, [])
  }
})

test('Escape in an editable control remains available to its existing cancel behavior', () => {
  const ui = harness('panel')
  const dialog = ui.layer('dialog')
  ui.addFarmEscapeListener()
  const event = ui.key('Escape', { target: { tagName: 'INPUT', getAttribute: () => null } })
  assert.equal(dialog.dismissed, true)
  assert.equal(event.defaultPrevented, false)
  assert.deepEqual(ui.calls, [])

  const editorOnly = harness('ext')
  const editorEvent = editorOnly.key('Escape', { target: { tagName: 'TEXTAREA', getAttribute: () => null } })
  assert.equal(editorEvent.defaultPrevented, false)
  assert.deepEqual(editorOnly.calls, [])
})

test('repeated Escape after dismissing a layer does not close its native window', () => {
  const ui = harness('ext')
  const popup = ui.layer('farm-overlay')
  ui.addFarmEscapeListener()
  ui.key('Escape')
  assert.equal(popup.dismissed, true)
  const repeated = ui.key('Escape', { repeat: true })
  assert.equal(repeated.defaultPrevented, false)
  assert.deepEqual(ui.calls, [])
  ui.key('Escape')
  assert.deepEqual(ui.calls, ['piggy:ext:close'])
})

test('a preload VM without document remains compatible with existing non-renderer harnesses', () => {
  const calls = []
  runInNewContext(SOURCE, {
    process: { argv: [] },
    require: () => ({ contextBridge: { exposeInMainWorld() {} }, ipcRenderer: { send: (...args) => calls.push(args), sendSync() {}, on() {}, invoke() {} } }),
  })
  assert.deepEqual(calls, [])
})
