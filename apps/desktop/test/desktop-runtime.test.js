// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDesktopRuntime } from '../lib/desktop-runtime.js'
import { createDesktopLifecycle } from '../lib/desktop-lifecycle.js'

function deferred() {
  /** @type {(value: any) => void} */
  let resolve = () => {}
  /** @type {(reason?: any) => void} */
  let reject = () => {}
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('startup owner exposes each pending promise and then the resolved live handles', async () => {
  const versionsPending = deferred()
  const hostPending = deferred()
  const calls = []
  const runtime = createDesktopRuntime({
    startVersionsWorker: options => { calls.push(['versions', options]); return versionsPending.promise },
    startHostWorker: (gameDir, statePath, options) => { calls.push(['host', gameDir, statePath, options]); return hostPending.promise },
  })
  const versionsPromise = runtime.startVersions({ marker: 'versions-options' })
  const hostPromise = runtime.startHost('/game', '/save/state.json', { marker: 'host-options' })

  assert.equal(runtime.getShutdownResources().versionsStarting, versionsPromise)
  assert.equal(runtime.getShutdownResources().hostStarting, hostPromise)
  assert.equal(runtime.getVersions(), null)
  assert.equal(runtime.getHost(), null)
  assert.deepEqual(calls, [
    ['versions', { marker: 'versions-options' }],
    ['host', '/game', '/save/state.json', { marker: 'host-options' }],
  ])

  const versions = { close() {} }
  const host = { dispose() {} }
  versionsPending.resolve(versions)
  hostPending.resolve(host)
  assert.deepEqual(await Promise.all([versionsPromise, hostPromise]), [versions, host])
  assert.equal(runtime.getVersions(), versions)
  assert.equal(runtime.getHost(), host)
  assert.equal(runtime.getShutdownResources().versionsStarting, versionsPromise)
  assert.equal(runtime.getShutdownResources().hostStarting, hostPromise)
})

test('worker startup rejection is preserved and remains visible to shutdown', async () => {
  const failure = new Error('versions worker failed')
  const runtime = createDesktopRuntime({
    startVersionsWorker: () => Promise.reject(failure),
    startHostWorker: async () => ({}),
  })
  const starting = runtime.startVersions({})
  assert.equal(runtime.getShutdownResources().versionsStarting, starting)
  await assert.rejects(starting, error => error === failure)
  assert.equal(runtime.getShutdownResources().versionsStarting, starting)
  assert.equal(runtime.getVersions(), null)
})

test('quit waits for pending starts, then closes the live host and versions handles', async () => {
  const versionsPending = deferred()
  const hostPending = deferred()
  const order = []
  const versions = { async close() { order.push('versions-close') } }
  const host = { async dispose() { order.push('host-dispose'); return { saved: true } } }
  const runtime = createDesktopRuntime({
    startVersionsWorker: () => versionsPending.promise,
    startHostWorker: () => hostPending.promise,
  })
  const versionsStarting = runtime.startVersions({})
  const hostStarting = runtime.startHost('/game', '/save/state.json', {})
  /** @type {((event: any) => void) | null} */
  let beforeQuit = null
  const app = {
    on(name, listener) { if (name === 'before-quit') beforeQuit = listener },
    quit() { order.push('app-quit') },
    exit() { throw new Error('unexpected forced exit') },
  }
  const lifecycle = createDesktopLifecycle({
    app, dialog: { async showMessageBox() { return {} } }, log: (...parts) => order.push(`log:${parts[0]}`),
    stopDrag() {}, relaunch() { throw new Error('unexpected relaunch') }, isCapture: () => false,
    clearInterval, clearTimeout,
    getResources: () => ({
      ...runtime.getShutdownResources(),
      proxySettings: { async init() { order.push('proxy-init') }, async flush() { order.push('proxy-flush') } },
      shellUpdates: { async close() { order.push('shell-close') } },
      fullscreenWatch: null, autostart: { async flush() { order.push('autostart-flush') } },
      exportWrites: new Set(), topGuardTimer: null, displayWatchTimer: null, hitTimer: null, stateTimer: null,
      flushWindowState: async () => { order.push('window-state-flush') },
      flushLogs: async () => { order.push('logs-flush') },
    }),
    setExternalManager() {}, setHitTimer() {},
  })
  lifecycle.registerBeforeQuit()
  if (beforeQuit === null) throw new Error('before-quit listener was not registered')
  beforeQuit({ preventDefault() { order.push('prevent-default') } })
  const quitTask = lifecycle.quitTask
  await Promise.resolve()
  assert.equal(order.includes('host-dispose'), false)
  assert.equal(order.includes('versions-close'), false)

  versionsPending.resolve(versions)
  await Promise.resolve()
  assert.equal(order.includes('host-dispose'), false, 'quit still waits for the host startup promise')
  hostPending.resolve(host)
  await quitTask
  assert.equal(order.includes('host-dispose'), true)
  assert.equal(order.includes('versions-close'), true)
  assert.ok(order.indexOf('host-dispose') < order.indexOf('versions-close'))
  assert.equal(order.at(-1), 'app-quit')
  assert.equal(runtime.getHost(), host)
  assert.equal(runtime.getVersions(), versions)
  assert.equal(runtime.getShutdownResources().hostStarting, hostStarting)
  assert.equal(runtime.getShutdownResources().versionsStarting, versionsStarting)
})

test('host startup rejection still closes an already-started versions service and quits', async () => {
  const order = []
  const versions = { async close() { order.push('versions-close') } }
  const failure = new Error('host worker failed')
  const runtime = createDesktopRuntime({
    startVersionsWorker: async () => versions,
    startHostWorker: async () => { throw failure },
  })
  await runtime.startVersions({})
  const hostStarting = runtime.startHost('/game', '/save/state.json', {})
  const rejected = assert.rejects(hostStarting, error => error === failure)
  /** @type {((event: any) => void) | null} */
  let beforeQuit = null
  const app = {
    on(name, listener) { if (name === 'before-quit') beforeQuit = listener },
    quit() { order.push('app-quit') },
    exit() { throw new Error('unexpected forced exit') },
  }
  const lifecycle = createDesktopLifecycle({
    app, dialog: { async showMessageBox() { return {} } }, log() {}, stopDrag() {}, relaunch() {},
    isCapture: () => false, clearInterval, clearTimeout,
    getResources: () => ({
      ...runtime.getShutdownResources(),
      proxySettings: { async init() {}, async flush() {} }, shellUpdates: { async close() {} },
      fullscreenWatch: null, autostart: { async flush() {} }, exportWrites: new Set(),
      topGuardTimer: null, displayWatchTimer: null, hitTimer: null, stateTimer: null,
      flushWindowState: async () => {}, flushLogs: async () => {},
    }),
    setExternalManager() {}, setHitTimer() {},
  })
  lifecycle.registerBeforeQuit()
  if (beforeQuit === null) throw new Error('before-quit listener was not registered')
  beforeQuit({ preventDefault() {} })
  await lifecycle.quitTask
  await rejected
  assert.ok(order.includes('versions-close'))
  assert.equal(order.at(-1), 'app-quit')
})
