import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPanelWindow } from '../lib/panel-window.js'

class FakeEmitter {
  listeners = new Map()
  on(name, listener) {
    const rows = this.listeners.get(name) ?? []
    rows.push(listener)
    this.listeners.set(name, rows)
  }
  emit(name, ...args) {
    for (const listener of this.listeners.get(name) ?? []) listener(...args)
  }
}

class FakeWindow extends FakeEmitter {
  static created = []
  constructor(options) {
    super()
    this.options = options
    this.destroyed = false
    this.webContents = new FakeEmitter()
    this.webContents.setFrameRate = value => { this.frameRate = value }
    this.webContents.loadURL = value => { this.url = value }
    this.webContents.openDevTools = value => { this.devTools = value }
    FakeWindow.created.push(this)
  }
  loadURL(value) { this.url = value }
  isDestroyed() { return this.destroyed }
  destroy() { this.destroyed = true }
}

test('panel-window owns one current window and resets readiness across renderer loss/recreation', () => {
  FakeWindow.created = []
  const events = []
  const panel = createPanelWindow({
    BrowserWindow: FakeWindow,
    options: { show: false },
    url: 'piggy://app/index.html',
    frameCap: 30,
    devTools: true,
    log: (...parts) => events.push(['log', ...parts]),
    onCreated: window => events.push(['created', window]),
    onReady: window => events.push(['ready', window]),
    onRendererGone: (window, details) => events.push(['gone', window, details]),
    onBlur: () => events.push(['blur']),
  })

  const first = panel.ensure()
  assert.equal(panel.ensure(), first)
  assert.equal(panel.current(), first)
  assert.equal(panel.isReady(), false)
  assert.equal(first.options.show, false)
  assert.equal(first.url, 'piggy://app/index.html')
  assert.equal(first.frameRate, 30)
  assert.deepEqual(first.devTools, { mode: 'detach' })
  assert.equal(events.filter(([kind]) => kind === 'created').length, 1)

  first.webContents.emit('did-finish-load')
  assert.equal(panel.isReady(), true)
  assert.equal(events.filter(([kind]) => kind === 'ready').length, 1)
  first.emit('blur')
  assert.equal(events.filter(([kind]) => kind === 'blur').length, 1)

  const details = { reason: 'crashed' }
  first.webContents.emit('render-process-gone', {}, details)
  assert.equal(panel.current(), null)
  assert.equal(panel.isReady(), false)
  assert.equal(events.filter(([kind]) => kind === 'gone').length, 1)

  const second = panel.ensure()
  assert.notEqual(second, first)
  assert.equal(panel.isReady(), false)
  first.webContents.emit('did-finish-load')
  first.webContents.emit('render-process-gone', {}, { reason: 'stale' })
  first.emit('blur')
  assert.equal(panel.current(), second)
  assert.equal(panel.isReady(), false)
  assert.equal(events.filter(([kind]) => kind === 'ready').length, 1)
  assert.equal(events.filter(([kind]) => kind === 'gone').length, 1)
  assert.equal(events.filter(([kind]) => kind === 'blur').length, 1)
  panel.destroy(second)
  assert.equal(panel.current(), null)
  assert.equal(panel.isReady(), false)
  assert.equal(second.isDestroyed(), true)
})

test('panel-window resolves a function url every time it creates a window', () => {
  FakeWindow.created = []
  let pig = 'pig-a'
  const panel = createPanelWindow({
    BrowserWindow: FakeWindow,
    options: { show: false },
    url: () => `piggy://app/index.html?pig=${pig}`,
    log() {},
  })
  const first = panel.ensure()
  assert.equal(first.url, 'piggy://app/index.html?pig=pig-a')
  panel.destroy(first)
  pig = 'pig-b'
  const second = panel.ensure()
  assert.equal(second.url, 'piggy://app/index.html?pig=pig-b')
})
