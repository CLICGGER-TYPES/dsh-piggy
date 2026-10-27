// @ts-check
/**
 * PR15+rc2 组合后的舞台生命周期缺口：单实例 ready 闸门、启动等待中的退出、
 * 日志串行落盘，以及退出时等待全屏探测/代理/日志收尾。
 *
 * 只跑源码片段和注入的假依赖，不启动 Electron、不碰真实 userData。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { createContext, runInContext } from 'node:vm'

import { createStageJournal, createStageQuit } from '../stage/startup-lifecycle.js'

const source = readFileSync(new URL('../stage/main.js', import.meta.url), 'utf8')
const lifecycle = readFileSync(new URL('../stage/startup-lifecycle.js', import.meta.url), 'utf8')

/** whenReady(async () => { ... }) 的函数体；不执行文件顶部依赖 Electron 的代码。 */
function readyCallbackBody() {
  const start = source.indexOf('app.whenReady().then(async () => {')
  assert.ok(start >= 0, 'stage main has a ready callback')
  const bodyStart = source.indexOf('{', start) + 1
  const bodyEnd = source.indexOf('\n}).catch(error =>', start)
  assert.ok(bodyEnd > bodyStart, 'the ready callback is followed by the startup-failure catch')
  return source.slice(bodyStart, bodyEnd)
}

async function runReady(context) {
  context.APP_ROOT ??= '/tmp/piggy-stage-app'
  context.dataPaths ??= {}
  context.migrateDesktopData ??= () => {}
  const fn = runInContext(`(async () => {${readyCallbackBody()}})()`, createContext(context))
  return fn
}

test('拿不到单实例锁时，quit 之后的 ready 不再初始化代理、版本或宿主', async () => {
  const calls = []
  const context = {
    needsX11: false, gotLock: false, quitting: false,
    log: (...parts) => { calls.push(parts.join(' ')) },
    createProxy() { calls.push('proxy'); throw new Error('second instance touched proxy') },
    session: { defaultSession: {}, fromPartition: () => ({}) },
    app: { getPath: () => '/tmp/piggy-stage', getVersion: () => '0.6.8' },
    process: { platform: 'linux', env: {}, argv: [] },
  }
  await runReady(context)
  assert.deepEqual(calls, [], 'the second instance must not even log a normal start or touch the proxy')
})

test('等待代理初始化期间退出，不再继续创建更新器和版本服务', async () => {
  const calls = []
  const context = {
    needsX11: false, gotLock: true, quitting: false,
    log: () => {},
    join,
    createProxy() {
      calls.push('proxy')
      return { async init() { calls.push('proxy-init'); context.quitting = true } }
    },
    shellUpdateMode() { calls.push('shell-mode'); throw new Error('continued after quit during proxy init') },
    session: { defaultSession: {}, fromPartition: () => ({}) },
    app: { getPath: () => '/tmp/piggy-stage', getVersion: () => '0.6.8' },
    process: { platform: 'linux', env: {}, argv: [] },
  }
  await runReady(context)
  assert.deepEqual(calls, ['proxy', 'proxy-init'], 'the ready callback returns as soon as quitting is seen')
})

test('等待宿主启动期间退出，新宿主会被关掉而不是继续挂协议和窗口', async () => {
  const calls = []
  const context = {
    needsX11: false, gotLock: true, quitting: false,
    host: null, hostSaved: null, hostJournal: null, versions: null, shellUpdates: null, proxy: null,
    join,
    app: { getPath: () => '/tmp/piggy-stage', getVersion: () => '0.6.8' },
    process: { platform: 'linux', env: {}, argv: [] },
    session: { defaultSession: {}, fromPartition: () => ({}) },
    net: { fetch: () => {} },
    autoUpdater: {},
    log: () => {},
    flushLogs: async () => { calls.push('logs-flushed') },
    bundledGameDir: () => '/tmp/piggy-game',
    statePath: () => '/tmp/piggy-stage/state.json',
    createProxy() { calls.push('proxy'); return { async init() {} } },
    shellUpdateMode: () => 'development',
    createShellUpdates: () => ({}),
    createVersions: () => ({ needsGame: () => false, activeDir: () => '/tmp/piggy-game' }),
    async startBackgroundHost() {
      calls.push('host-start')
      context.quitting = true
      return { dispose: async () => { calls.push('host-dispose'); return { saved: true } } }
    },
    cleanup: { add() { calls.push('cleanup-add') }, async dispose() { return { ok: true } } },
    protocol: { handle() { calls.push('protocol'); throw new Error('continued after quit during host start') } },
    registerStageIpc() { calls.push('ipc') },
    toPages: () => {},
  }
  await runReady(context)
  assert.deepEqual(calls, ['proxy', 'host-start', 'host-dispose', 'logs-flushed'],
    'the host that appeared after quit must be disposed and its logs flushed before returning')
})

test('stage 日志按调用顺序串行落盘，flush 等完最后一行且失败不会冒充成功', async () => {
  const writes = []
  let fail = false
  const journal = createStageJournal({
    logPath: () => '/tmp/piggy-stage/stage.log',
    capture: () => false,
    async append(file, line) {
      const marker = line.slice(line.indexOf('] ') + 2).trim()
      writes.push('start:' + marker)
      await new Promise(resolve => setTimeout(resolve, 2))
      writes.push('end:' + marker)
      return !fail || !marker.includes('bad')
    },
  })

  const first = journal.log('one')
  const second = journal.log('two')
  assert.equal(await journal.flush(), true)
  assert.deepEqual(await Promise.all([first, second]), [true, true])
  assert.deepEqual(writes, ['start:one', 'end:one', 'start:two', 'end:two'],
    'the second line waits for the first line to finish')

  writes.length = 0
  fail = true
  assert.equal(await journal.log('bad'), false, 'a failed journal write must not resolve as success')
  assert.equal(await journal.log('good'), true, 'one failure does not poison the following write')
  assert.equal(await journal.flush(), false, 'flush reports the earlier failure')
  assert.deepEqual(writes, ['start:bad', 'end:bad', 'start:good', 'end:good'])
})


test('退出顺序是 cleanup（含宿主保存）-> proxy.flush -> 日志 flush，并把 saved 返回给保存门禁', async () => {
  const order = []
  const quit = createStageQuit({
    app: { quit: () => order.push('app-quit') },
    cleanup: { async dispose() { order.push('cleanup'); return { ok: true } } },
    log: (...parts) => { order.push('log:' + parts[0]) },
    flushLogs: async () => { order.push('logs'); return true },
    getProxy: () => ({ async flush() { order.push('proxy') } }),
    getHost: () => ({}),
    getHostSaved: () => true,
    setQuitting: value => { order.push('quitting:' + value) },
  })
  assert.deepEqual(await quit.prepare(), { ok: true, saved: true })
  assert.deepEqual(order, ['quitting:true', 'cleanup', 'proxy', 'log:cleanup done', 'logs'])

  const unsaved = createStageQuit({
    app: { quit() {} }, cleanup: { async dispose() { return { ok: true } } },
    log() {}, flushLogs: async () => true, getProxy: () => null,
    getHost: () => ({}), getHostSaved: () => false, setQuitting() {},
  })
  assert.deepEqual(await unsaved.prepare(), { ok: true, saved: false }, 'dispose 没保存成功时不能上报 saved')
})

test('stage main 在退出路径等待全屏探测、代理和日志，并保留显式 work-events 模式', () => {
  // 外部桌宠要按需启停工作事件端点，所以目录总是交给宿主；真正「听不听」
  // 由 workEventsAutoStart 决定，只有显式 --work-events 才自动开始。
  assert.match(source, /const workEventsDirectory = join\(app\.getPath\('userData'\), 'work-endpoint'\)/)
  assert.match(source, /host = await startBackgroundHost\([\s\S]{0,260}workEventsDirectory/,
    'work-events 的目录要传给宿主；只听显式开关')
  assert.match(source, /workEventsAutoStart: process\.argv\.includes\('--work-events'\)/,
    '只有显式 --work-events 才让宿主自动开始监听')
  assert.doesNotMatch(source, /startBackgroundHost\([^)]*workEventsDirectory: join\(app\.getPath\('userData'\), 'work-endpoint'\)/,
    '不能无条件开启 work-events 目录')
  assert.match(source, /fullscreen = await watchFullscreen\(/, 'watchFullscreen 改为异步后仍要等它返回')
  assert.match(source, /try \{ await fullscreen\.stop\(\) \} finally \{ await fullscreen\.flush\?\.\(\) \}/,
    '退出要等全屏探测停止并刷完设置')
  assert.match(lifecycle, /await deps\.getProxy\(\)\?\.flush\?\.\(\)/, '退出要等代理配置写完')
  assert.match(lifecycle, /await deps\.flushLogs\(\)/, '退出要等日志链排空')
  assert.match(source, /await flushLogs\(\)/, '启动等待中退出也要把日志排空')
  assert.match(source, /const gotLock = !needsX11 && startup\.acquireSingleInstance\(\)/)
  assert.match(source, /if \(needsX11 \|\| !gotLock \|\| quitting\) return/)
})
