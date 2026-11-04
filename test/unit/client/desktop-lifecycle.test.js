// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDesktopLifecycle } from '../../../apps/desktop/lib/desktop-lifecycle.js'

function deferred() {
  /** @type {(value?: any) => void} */ let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve: value => resolve(value) }
}

function createHarness(overrides = {}) {
  const calls = []
  let resources = {
    host: null, hostStarting: null, versions: null, versionsStarting: null, shellUpdates: null, proxySettings: null,
    fullscreenWatch: null, externalManager: null, autostart: { flush: () => { calls.push('autostart') } },
    exportWrites: new Set(), topGuardTimer: 1, displayWatchTimer: 2, hitTimer: 3, stateTimer: 4,
    flushWindowState: () => { calls.push('window-state') }, flushLogs: () => { calls.push('logs') },
  }
  let handler = null
  const app = {
    on(_name, callback) { handler = callback },
    quit() { calls.push('app.quit') },
    exit(code) { calls.push(`app.exit:${code}`) },
  }
  const lifecycle = createDesktopLifecycle({
    app, dialog: { async showMessageBox() { calls.push('dialog') } },
    log: (...parts) => calls.push('log:' + parts.join(' ')), stopDrag: () => calls.push('stop-drag'), relaunch: () => calls.push('relaunch'),
    isCapture: () => false, clearInterval: timer => calls.push(`clear-interval:${timer}`), clearTimeout: timer => calls.push(`clear-timeout:${timer}`),
    getResources: () => resources,
    setExternalManager: manager => { resources.externalManager = manager; calls.push(`external:${manager === null ? 'null' : 'set'}`) },
    setHitTimer: timer => { resources.hitTimer = timer; calls.push(`hit:${timer}`) },
    ...overrides,
  })
  return { calls, app, lifecycle, get resources() { return resources }, set resources(value) { resources = value }, fireQuit() { handler?.({ preventDefault() { calls.push('prevent') } }) } }
}

test('资源关闭顺序保留；versions 在前一批 flush 后按 live getter 读取', async () => {
  const gate = deferred(), calls = []
  let versionService = { async close() { calls.push('versions:old') } }
  const harness = createHarness()
  harness.resources = {
    ...harness.resources,
    shellUpdates: { async close() { calls.push('shell-updates') } },
    proxySettings: { async flush() { calls.push('proxy') } },
    fullscreenWatch: { stop() { calls.push('fullscreen:stop'); return Promise.resolve() }, async flush() { calls.push('fullscreen:flush') } },
    autostart: { async flush() { calls.push('autostart') } },
    exportWrites: new Set([gate.promise]),
    flushWindowState: async () => { calls.push('window-state'); await gate.promise },
    flushLogs: async () => { calls.push('logs') },
    get versions() { return versionService },
  }
  const closing = harness.lifecycle.closeShellResources()
  assert.equal(harness.lifecycle.closeShellResources({ keepShellUpdates: true }), closing, 'the first close call owns options')
  assert.deepEqual(calls.filter(value => ['fullscreen:stop', 'shell-updates', 'window-state', 'proxy', 'fullscreen:flush', 'autostart'].includes(value)),
    ['fullscreen:stop', 'shell-updates', 'window-state', 'proxy', 'fullscreen:flush', 'autostart'])
  versionService = { async close() { calls.push('versions:new') } }
  gate.resolve()
  await closing
  assert.ok(calls.indexOf('versions:new') > calls.indexOf('autostart'), JSON.stringify(calls))
  assert.equal(calls.includes('versions:old'), false)
  assert.equal(calls.at(-1), 'logs')
  assert.equal(harness.lifecycle.shellClosed, true)
})

test('安装交接保留 shellUpdates，保存失败可重试且不提前清 hitTimer', async () => {
  const calls = []
  let attempts = 0
  const harness = createHarness()
  harness.resources = {
    ...harness.resources,
    shellUpdates: { async close() { calls.push('shell-updates') } },
    externalManager: { async close() { calls.push('external-close') } },
    host: { async dispose() { attempts++; calls.push(`dispose:${attempts}`); if (attempts === 1) throw new Error('save blocked'); return { saved: true } } },
  }
  await assert.rejects(harness.lifecycle.prepareToQuit(), /save blocked/)
  assert.equal(harness.lifecycle.quitting, false)
  assert.equal(harness.lifecycle.hostClosing, null)
  assert.equal(harness.resources.hitTimer, 3)
  assert.equal(harness.lifecycle.hostClosed, false)
  await harness.lifecycle.prepareToQuit()
  await harness.lifecycle.closeShellResources({ keepShellUpdates: true })
  assert.equal(attempts, 2)
  assert.equal(calls.filter(value => value === 'external-close').length, 1)
  assert.equal(calls.includes('shell-updates'), false)
  assert.equal(harness.lifecycle.hostClosed, true)
  assert.equal(harness.resources.hitTimer, null)
  assert.equal(harness.lifecycle.shellClosed, true)
})

test('资源 flush 失败会释放 closing Promise，允许重试完成关闭', async () => {
  let attempts = 0
  const harness = createHarness()
  harness.resources = {
    ...harness.resources,
    async flushWindowState() {
      attempts++
      if (attempts === 1) throw new Error('window flush blocked')
    },
  }
  await assert.rejects(harness.lifecycle.closeShellResources(), /window flush blocked/)
  assert.equal(harness.lifecycle.shellClosing, null)
  assert.equal(harness.lifecycle.shellClosed, false)
  await harness.lifecycle.closeShellResources()
  assert.equal(attempts, 2)
  assert.equal(harness.lifecycle.shellClosed, true)
})

test('before-quit 等 active prepare 取消并通过 releaseAction 继续退出', async () => {
  const harness = createHarness()
  let cancellations = 0
  harness.resources = {
    ...harness.resources,
    versions: { async cancelPreparation() { cancellations++ }, async close() {} },
    host: { async dispose() { return { saved: true } } },
    shellUpdates: { async close() {} },
  }
  const action = harness.lifecycle.reserveAction('game-install', 'prepare')
  assert.ok(action)
  harness.lifecycle.registerBeforeQuit()
  harness.fireQuit()
  assert.equal(action.cancelled, true)
  assert.equal(cancellations, 1)
  assert.equal(harness.lifecycle.quitting, true)
  harness.lifecycle.releaseAction(action)
  assert.equal(harness.lifecycle.activeAction, null)
  assert.equal(harness.calls.at(-1), 'app.quit')
  await harness.lifecycle.quitTask
})
