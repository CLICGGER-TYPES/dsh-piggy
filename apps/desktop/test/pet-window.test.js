import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createPetWindow } from '../lib/pet-window.js'

class FakeWindow extends EventEmitter {
  static created = []
  constructor(options) {
    super()
    this.options = options
    this.destroyed = false
    this.webContents = new EventEmitter()
    FakeWindow.created.push(this)
  }
  loadURL(url) { this.url = url }
  isDestroyed() { return this.destroyed }
  destroy() { this.destroyed = true; this.emit('closed') }
}

test('pet-window keeps one current owner and ignores lifecycle events from replaced windows', () => {
  FakeWindow.created = []
  const events = []
  const owner = createPetWindow({ BrowserWindow: FakeWindow })
  const makeInput = name => ({
    options: { name }, url: `piggy://app/${name}.html`,
    configure: window => events.push(['configure', window.options.name]),
    afterLoad: window => events.push(['after-load', window.options.name]),
    onClosed: window => events.push(['closed', window.options.name]),
    onReadyToShow: window => events.push(['ready', window.options.name]),
    onDidFinishLoad: window => events.push(['loaded', window.options.name]),
    onDidFailLoad: (window, ...args) => events.push(['failed', window.options.name, ...args]),
    onRendererGone: (window, _event, details) => events.push(['gone', window.options.name, details]),
  })

  const first = owner.create(makeInput('first'))
  assert.equal(owner.current(), first)
  assert.equal(first.url, 'piggy://app/first.html')
  assert.deepEqual(events.slice(0, 2), [['configure', 'first'], ['after-load', 'first']])

  const second = owner.create(makeInput('second'))
  assert.equal(owner.current(), second)
  owner.destroy(first)
  assert.equal(first.isDestroyed(), true)
  assert.equal(owner.current(), second, 'destroying the replaced window cannot clear the current one')

  first.emit('ready-to-show', {})
  first.webContents.emit('did-finish-load', {})
  first.webContents.emit('did-fail-load', {}, -1, 'stale', 'piggy://old', true)
  first.webContents.emit('render-process-gone', {}, { reason: 'stale' })
  assert.deepEqual(events.filter(([kind]) => ['ready', 'loaded', 'failed', 'gone', 'closed'].includes(kind)), [])

  const failure = [{}, -105, 'NAME_NOT_RESOLVED', 'piggy://app/second.html', true]
  second.emit('ready-to-show', {})
  second.webContents.emit('did-finish-load', {})
  second.webContents.emit('did-fail-load', ...failure)
  const details = { reason: 'crashed' }
  second.webContents.emit('render-process-gone', {}, details)
  assert.deepEqual(events.filter(([kind]) => ['ready', 'loaded', 'failed', 'gone'].includes(kind)), [
    ['ready', 'second'], ['loaded', 'second'], ['failed', 'second', ...failure], ['gone', 'second', details],
  ])

  second.destroy()
  assert.equal(owner.current(), null)
  assert.deepEqual(events.at(-1), ['closed', 'second'])
})
