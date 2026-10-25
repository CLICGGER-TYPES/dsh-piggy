// @ts-check
/**
 * 舞台启动诊断：whenReady 失败、首次主框架加载失败、首次 renderer 崩溃、第二次启动。
 *
 * 全部是注入的假事件/假依赖，不启动 Electron、不开窗口（原生验收由 root 在虚拟机做）。
 * 重点验证「原始错误先落日志 -> 只弹一次 -> 走 cleanup 的 quit（不是 app.exit）」的顺序，
 * 以及窗口已经显示/正在退出时不再弹框。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createStageStartup, shouldShowSecondInstance } from '../stage/startup-lifecycle.js'

const tick = () => new Promise(resolve => setImmediate(resolve))

/** 假 Electron：窗口、app、dialog、日志全部记录调用顺序。 */
function makeHarness(options = {}) {
  const order = []
  const logs = []
  const dialogs = []
  const errorBoxes = []
  const quits = []
  const state = {
    visible: options.visible === true,
    minimized: options.minimized === true,
    quitting: options.quitting === true,
    lock: options.lock !== false,
    ready: options.ready !== false,
  }
  const win = {
    isDestroyed: () => false,
    isVisible: () => state.visible,
    isMinimized: () => state.minimized,
    showInactive: () => order.push('show'),
  }
  const handlers = new Map()
  let releaseStartupLog = null
  const startupLogGate = new Promise(resolve => { releaseStartupLog = resolve })
  const webContents = {
    on: (channel, handler) => handlers.set(channel, handler),
    emit: (channel, ...args) => handlers.get(channel)?.(...args),
  }
  const app = {
    on: (channel, handler) => handlers.set('app:' + channel, handler),
    emit: (channel, ...args) => handlers.get('app:' + channel)?.(...args),
    requestSingleInstanceLock: () => state.lock,
    getVersion: () => '0.6.7',
    isReady: () => state.ready,
    exit: () => order.push('app.exit'),
  }
  const deps = {
    app,
    dialog: {
      showMessageBoxSync: value => { order.push('dialog'); dialogs.push(value) },
      showErrorBox: (title, content) => { order.push('errorbox'); errorBoxes.push({ title, content }) },
    },
    log: (...parts) => {
      const text = parts.join(' ')
      logs.push(text)
      order.push('log:' + text.split(' ')[0])
      if (options.deferStartupLog === true && text.startsWith('startup failed ')) {
        return startupLogGate.then(() => true)
      }
      return Promise.resolve(true)
    },
    logPath: () => options.logPath ?? '/tmp/stage.log',
    getWindow: () => (options.window === false ? null : win),
    isQuitting: () => state.quitting,
    quit: reason => {
      // main.js 的 requestQuit 第一件事就是把 quitting 置真；假 quit 照做，才能测重复事件。
      state.quitting = true
      order.push('quit:' + reason)
      quits.push(reason)
    },
    platform: 'linux',
  }
  return { order, logs, dialogs, errorBoxes, quits, state, win, app, webContents, deps, handlers, releaseStartupLog }
}

test('whenReady failure logs the original error, shows one dialog, then quits through cleanup', async () => {
  const harness = makeHarness()
  const startup = createStageStartup(harness.deps)
  const error = new Error('host start failed')

  assert.equal(await startup.startupFailed(error), true)
  const fatalLog = harness.order.indexOf('log:startup')
  const dialog = harness.order.indexOf('dialog')
  assert.ok(fatalLog >= 0 && fatalLog < dialog, 'the original error is persisted before the dialog opens')
  assert.ok(harness.order.indexOf('log:startup') < harness.order.indexOf('quit:startup-failed'))
  assert.deepEqual(harness.quits, ['startup-failed'])
  assert.ok(!harness.order.includes('app.exit'), 'exit owns cleanup, so never app.exit')
  assert.equal(harness.dialogs.length, 1)
  assert.match(harness.dialogs[0].detail, /host start failed/)
  const written = harness.logs.find(line => line.startsWith('startup failed'))
  assert.match(written, /host start failed/)
  assert.match(written, /startup-lifecycle|Error/, 'the journal keeps the stack, not just the message')

  assert.equal(await startup.startupFailed(new Error('again')), false)
  assert.equal(harness.dialogs.length, 1, 'later failures do not open another dialog')
  assert.deepEqual(harness.quits, ['startup-failed'])
})

test('a failure before ready uses showErrorBox instead of waiting for ready', async () => {
  const harness = makeHarness({ ready: false })
  const startup = createStageStartup(harness.deps)

  await startup.startupFailed(new Error('early boom'))
  assert.equal(harness.dialogs.length, 0, 'showMessageBoxSync would wait for ready and deadlock the entry')
  assert.equal(harness.errorBoxes.length, 1)
  assert.match(harness.errorBoxes[0].title, /没能启动/)
  assert.match(harness.errorBoxes[0].content, /early boom/)
  assert.deepEqual(harness.quits, ['startup-failed'])
})

test('main-frame load failure is visible only before the stage has been shown', async () => {
  const hidden = makeHarness()
  const hiddenStartup = createStageStartup(hidden.deps)
  assert.equal(await hiddenStartup.pageFailed({ mainFrame: true, errorCode: -105, errorDescription: 'NAME_NOT_RESOLVED' }), true)
  assert.equal(hidden.dialogs.length, 1)
  assert.match(hidden.dialogs[0].detail, /NAME_NOT_RESOLVED/)
  assert.deepEqual(hidden.quits, ['page-failed'])

  const shown = makeHarness({ visible: true })
  const shownStartup = createStageStartup(shown.deps)
  assert.equal(await shownStartup.pageFailed({ mainFrame: true, errorCode: -105, errorDescription: 'nope' }), false)
  assert.equal(shown.dialogs.length, 0)
  assert.deepEqual(shown.quits, [], 'a shown stage keeps running; attach still logs the event')

  const frame = makeHarness()
  const frameStartup = createStageStartup(frame.deps)
  assert.equal(await frameStartup.pageFailed({ mainFrame: false, errorCode: 0, errorDescription: '' }), false)
  assert.equal(frame.dialogs.length, 0, 'sub-frame failures are not startup failures')
})

test('first startup renderer crash is reported; a crash after the stage is visible only quits', async () => {
  const hidden = makeHarness()
  const hiddenStartup = createStageStartup(hidden.deps)
  hiddenStartup.attach(hidden.webContents)
  hidden.webContents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 5 })
  await tick()
  assert.equal(hidden.dialogs.length, 1)
  assert.match(hidden.dialogs[0].detail, /crashed/)
  assert.match(hidden.dialogs[0].detail, /5/)
  assert.deepEqual(hidden.quits, ['renderer-gone'])
  assert.ok(hidden.logs.some(line => line.startsWith('renderer gone') && /"visible":false/.test(line)),
    'the event line says whether the window had been shown')

  const shown = makeHarness({ visible: true })
  const shownStartup = createStageStartup(shown.deps)
  shownStartup.attach(shown.webContents)
  shown.webContents.emit('render-process-gone', {}, { reason: 'oom' })
  await tick()
  assert.equal(shown.dialogs.length, 0, 'no dialog while the stage is running')
  assert.deepEqual(shown.quits, ['renderer-gone'], 'the transparent stage still exits so it cannot block the desktop')
  assert.ok(shown.logs.some(line => line.startsWith('renderer gone') && /"visible":true/.test(line)))
})

test('the first failure owns the only report, even if a load failure and crashes arrive together', async () => {
  const harness = makeHarness()
  const startup = createStageStartup(harness.deps)
  startup.attach(harness.webContents)

  harness.webContents.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'piggy://app/stage/index.html', true)
  await tick()
  harness.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
  harness.webContents.emit('did-fail-load', {}, -6, 'FILE_NOT_FOUND', 'piggy://app/stage/index.html', true)
  await tick()

  assert.equal(harness.dialogs.length, 1)
  assert.deepEqual(harness.quits, ['page-failed'])
  assert.ok(harness.logs.some(line => line.startsWith('page failed')), 'the event itself is still logged')
  assert.ok(harness.logs.some(line => line.startsWith('renderer gone')))
  assert.ok(harness.logs.filter(line => line.startsWith('startup failed')).length === 1, 'the fatal report appears once')
})

test('a stalled startup-failed journal keeps the only quit until log and dialog finish', async () => {
  const harness = makeHarness({ deferStartupLog: true })
  const startup = createStageStartup(harness.deps)
  startup.attach(harness.webContents)

  harness.webContents.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'piggy://app/stage/index.html', true)
  await tick()
  harness.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
  await tick()
  await tick()

  assert.equal(harness.logs.filter(line => line.startsWith('startup failed')).length, 1,
    'the first failure has started its one report')
  assert.deepEqual(harness.quits, [], 'a crash while the journal write is pending must not quit early')
  assert.equal(harness.dialogs.length, 0, 'the dialog waits for the journal line')

  harness.releaseStartupLog()
  for (let i = 0; i < 5; i += 1) await tick()

  assert.equal(harness.dialogs.length, 1)
  assert.deepEqual(harness.quits, ['page-failed'], 'the first report owns exactly one cleanup-owning quit')
  const firstLog = harness.order.indexOf('log:startup')
  const dialog = harness.order.indexOf('dialog')
  const quit = harness.order.indexOf('quit:page-failed')
  assert.ok(firstLog >= 0 && firstLog < dialog && dialog < quit, 'log, then dialog, then quit')
  assert.equal(harness.logs.filter(line => line.startsWith('startup failure shown')).length, 1)
})

test('a failure during an intentional quit does not open a dialog', async () => {
  const harness = makeHarness({ quitting: true })
  const startup = createStageStartup(harness.deps)

  assert.equal(await startup.startupFailed(new Error('late')), false)
  assert.equal(harness.dialogs.length, 0)
  assert.deepEqual(harness.quits, [])
})

test('a stage shown once and later hidden is not a first-start failure', async () => {
  const harness = makeHarness()
  const startup = createStageStartup(harness.deps)
  startup.markShown()
  harness.state.visible = false

  assert.equal(await startup.pageFailed({ mainFrame: true, errorCode: -105, errorDescription: 'late' }), false)
  assert.equal(await startup.rendererGone({ reason: 'crashed' }), false)
  assert.equal(harness.dialogs.length, 0, 'a hidden but already-shown stage is not a failed first start')
  assert.deepEqual(harness.quits, [])
})

test('ready-to-show stays shut once a failure report starts or a quit is underway', async () => {
  const deferred = makeHarness({ deferStartupLog: true })
  const startup = createStageStartup(deferred.deps)
  assert.equal(startup.readyToShow(), true, 'a healthy first start may show')
  startup.attach(deferred.webContents)
  deferred.webContents.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'piggy://app/stage/index.html', true)
  await tick()
  assert.equal(startup.readyToShow(), false, 'no show while the startup failure report is in flight')
  deferred.releaseStartupLog()
  for (let i = 0; i < 5; i += 1) await tick()
  assert.equal(startup.readyToShow(), false, 'no show after the report has quit')

  const quitting = makeHarness({ quitting: true })
  assert.equal(createStageStartup(quitting.deps).readyToShow(), false, 'no show while quitting')
})

test('second instance logs the first window state and never overrides a fullscreen hide', () => {
  const harness = makeHarness()
  const startup = createStageStartup(harness.deps)
  startup.watchSecondInstance()

  harness.app.emit('second-instance')
  assert.deepEqual(harness.order, ['log:second', 'show'])
  const state = JSON.parse(harness.logs.at(-1).slice(harness.logs.at(-1).indexOf('{')))
  assert.deepEqual(state, { pid: process.pid, window: true, visible: false, minimized: false, quitting: false, fullscreenHidden: false })

  startup.markFullscreenHidden(true)
  harness.app.emit('second-instance')
  assert.equal(harness.order.filter(entry => entry === 'show').length, 1, 'a stage hidden for fullscreen stays hidden')
  assert.equal(JSON.parse(harness.logs.at(-1).slice(harness.logs.at(-1).indexOf('{'))).fullscreenHidden, true)

  harness.state.visible = true
  harness.app.emit('second-instance')
  assert.equal(harness.order.filter(entry => entry === 'show').length, 1, 'already visible: nothing to do')

  harness.state.visible = false
  harness.state.quitting = true
  harness.app.emit('second-instance')
  assert.equal(harness.order.filter(entry => entry === 'show').length, 1, 'quitting: do not show')
})

test('second instance decision is a pure function of the first window state', () => {
  assert.equal(shouldShowSecondInstance({ alive: true, visible: false, quitting: false, fullscreenHidden: false }), true)
  assert.equal(shouldShowSecondInstance({ alive: true, visible: true }), false)
  assert.equal(shouldShowSecondInstance({ alive: true, quitting: true }), false)
  assert.equal(shouldShowSecondInstance({ alive: true, fullscreenHidden: true }), false)
  assert.equal(shouldShowSecondInstance({ alive: false }), false)
  assert.equal(shouldShowSecondInstance({}), false)
})

test('a second process journals "second launch rejected" before the caller quits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-stage-startup-'))
  try {
    const harness = makeHarness({ lock: false, logPath: join(dir, 'stage.log') })
    const startup = createStageStartup(harness.deps)
    assert.equal(startup.acquireSingleInstance(), false)
    const journal = readFileSync(join(dir, 'stage.log'), 'utf8')
    assert.match(journal, /second launch rejected/)
    assert.match(journal, new RegExp(`"pid":${process.pid}`))
    assert.match(journal, /"version":"0\.6\.7"/)

    const first = makeHarness({ lock: true })
    assert.equal(createStageStartup(first.deps).acquireSingleInstance(), true)
    assert.equal(first.logs.length, 0, 'the first process does not write a rejection line')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('stage main wires the diagnostics and no longer force-shows or exits past cleanup', () => {
  const source = readFileSync(new URL('../stage/main.js', import.meta.url), 'utf8')
  assert.match(source, /startup\.attach\(stageWin\.webContents\)/)
  assert.match(source, /ready-to-show[\s\S]{0,160}startup\.readyToShow\(\)[\s\S]{0,160}startup\.markShown\(\)/,
    'ready-to-show is gated by the report/quit state and then records the first successful show')
  assert.match(source, /\.catch\(error => \{ void startup\.startupFailed\(error\) \}\)/)
  assert.match(source, /startup\.watchSecondInstance\(\)/)
  assert.match(source, /const gotLock = !needsX11 && startup\.acquireSingleInstance\(\)/)
  assert.match(source, /if \(!needsX11 && !gotLock\) app\.quit\(\)/)
  assert.doesNotMatch(source, /setTimeout\(\(\) => \{ if \(stageWin !== null[^\n]*showInactive/, 'no fixed force-show timer')
  assert.doesNotMatch(source, /app\.exit\(1\)/, 'startup failure must use the cleanup-owning quit')
})
