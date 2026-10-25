// @ts-check
/** 通过 NsisUpdater 的既有签名入口验证 Worker 协议及关闭，不读取安装器或访问网络。 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import workerThreads from 'node:worker_threads'
import { NsisUpdater } from 'electron-updater'

import { createShellUpdates } from '../lib/shell-update.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function createUpdater() {
  // 显式 app adapter 避免构造器加载 Electron；所有下载/安装入口均由用例替换。
  const updater = new NsisUpdater(null, /** @type {any} */ ({ version: '0.1.3' }))
  updater.quitAndInstall = () => assert.fail('签名测试不能启动安装器')
  return updater
}

function mockWorker(context) {
  const worker = new EventEmitter()
  const started = deferred()
  const terminating = deferred()
  const termination = deferred()
  const creations = []
  const terminations = []
  worker.terminate = () => { terminations.push('terminate'); terminating.resolve(); return termination.promise }
  context.mock.method(workerThreads, 'Worker', function (url, options) {
    creations.push({ url, options })
    started.resolve()
    return worker
  })
  // 同步 Node 内建模块的命名导出，生产代码仍使用原来的 Worker 构造入口。
  syncBuiltinESMExports()
  context.after(() => { context.mock.restoreAll(); syncBuiltinESMExports() })
  return { worker, started, terminating, termination, creations, terminations }
}

const responses = [
  { name: 'null signature result', event: 'message', payload: { kind: 'result', value: null }, value: null },
  { name: 'publisher mismatch', event: 'message', payload: { kind: 'result', value: 'publisher mismatch' }, value: 'publisher mismatch' },
  { name: 'invalid signature result', event: 'message', payload: { kind: 'result', value: 7 }, error: /返回了无效结果/ },
  { name: 'verifier rejection', event: 'message', payload: { kind: 'error', error: new Error('verifier failed') }, error: /verifier failed/ },
  { name: 'worker error', event: 'error', payload: new Error('worker failed'), error: /worker failed/ },
  { name: 'early successful exit', event: 'exit', payload: 0, error: /返回结果前退出（0）/ },
  { name: 'early failed exit', event: 'exit', payload: 9, error: /返回结果前退出（9）/ },
  { name: 'worker termination failure', event: 'message', payload: { kind: 'result', value: null }, terminationError: new Error('terminate failed'), error: /terminate failed/ },
]

for (const response of responses) {
  test(`signature close waits for ${response.name} and worker termination`, { skip: process.platform !== 'win32' }, async context => {
    const harness = mockWorker(context)
    const updater = createUpdater()
    const logs = []
    updater.logger = {
      info: message => logs.push(['info', message]),
      warn: message => logs.push(['warn', message]),
      error: message => logs.push(['error', message]),
    }
    const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
    const signature = updater.verifyUpdateCodeSignature(['Publisher'], 'never-read.exe')
    const observed = signature.then(value => ({ value }), error => ({ error }))
    await harness.started.promise
    const closing = updates.close()
    let closed = false
    closing.then(() => { closed = true })
    try {
      assert.equal(updates.close(), closing)
      assert.equal(harness.creations.length, 1)
      assert.match(harness.creations[0].url.href, /\/signature-worker\.js$/)
      assert.deepEqual(harness.creations[0].options.workerData, { publisherNames: ['Publisher'], tempPath: 'never-read.exe' })
      await setImmediate()
      assert.equal(closed, false, '关闭不能终止仍在验证的 Worker')
      assert.deepEqual(harness.terminations, [])
      assert.equal(harness.worker.listenerCount('message'), 1)
      for (const level of ['info', 'warn', 'error']) harness.worker.emit('message', { kind: 'log', level, message: level })
      assert.deepEqual(logs, [['info', 'info'], ['warn', 'warn'], ['error', 'error']])
      harness.worker.emit(response.event, response.payload)
      if (response.value === null) harness.worker.emit('exit', 0)
      await harness.terminating.promise
      assert.deepEqual(harness.terminations, ['terminate'])
      await setImmediate()
      assert.equal(closed, false, '收到结果/失败后仍须等待 Worker terminate 完成')
      if (response.terminationError) harness.termination.reject(response.terminationError)
      else harness.termination.resolve(0)
      const result = await observed
      await closing
      if (response.error) assert.match(result.error.message, response.error)
      else assert.deepEqual(result, { value: response.value })
      assert.equal(closed, true)
      await assert.rejects(updater.verifyUpdateCodeSignature(['Publisher'], 'never-read.exe'), /桌面外壳更新已关闭/)
      assert.equal(harness.creations.length, 1, '关闭后不能启动新的签名 Worker')
      assert.equal(updates.status().readyVersion, null)
      assert.equal(updates.install().ok, false)
    } finally {
      harness.worker.emit('message', { kind: 'result', value: null })
      harness.termination.resolve(0)
      await observed
      await closing
    }
  })
}

test('signature worker constructor failure rejects and close completes', { skip: process.platform !== 'win32' }, async context => {
  context.mock.method(workerThreads, 'Worker', function () { throw new Error('worker construction failed') })
  syncBuiltinESMExports()
  context.after(() => { context.mock.restoreAll(); syncBuiltinESMExports() })
  const updater = createUpdater()
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  await assert.rejects(updater.verifyUpdateCodeSignature(['Publisher'], 'never-read.exe'), /worker construction failed/)
  await updates.close()
})

test('close during signature verification waits for the download without making it ready', { skip: process.platform !== 'win32' }, async context => {
  const harness = mockWorker(context)
  const updater = createUpdater()
  updater.checkForUpdates = async () => /** @type {any} */ ({ updateInfo: { version: '0.2.0' } })
  updater.downloadUpdate = async () => {
    assert.equal(await updater.verifyUpdateCodeSignature(['Publisher'], 'never-read.exe'), null)
    return []
  }
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  const operation = updates.download('0.2.0')
  await harness.started.promise
  const closing = updates.close()
  try {
    harness.worker.emit('message', { kind: 'result', value: null })
    await harness.terminating.promise
    harness.termination.resolve(0)
    assert.deepEqual(await operation, { ok: false, reason: '桌面外壳更新已关闭' })
    await closing
    assert.equal(updates.status().readyVersion, null)
    assert.equal(updates.install().ok, false)
  } finally {
    harness.worker.emit('message', { kind: 'result', value: null })
    harness.termination.resolve(0)
    await operation
    await closing
  }
})

test('closing a pending download prevents a late signature worker from starting', { skip: process.platform !== 'win32' }, async context => {
  const entered = deferred()
  const release = deferred()
  context.mock.method(workerThreads, 'Worker', function () { assert.fail('关闭后不能启动签名 Worker') })
  syncBuiltinESMExports()
  context.after(() => { context.mock.restoreAll(); syncBuiltinESMExports() })
  const updater = createUpdater()
  updater.checkForUpdates = async () => /** @type {any} */ ({ updateInfo: { version: '0.2.0' } })
  updater.downloadUpdate = async () => {
    entered.resolve()
    await release.promise
    await updater.verifyUpdateCodeSignature(['Publisher'], 'never-read.exe')
    return []
  }
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  const operation = updates.download('0.2.0')
  await entered.promise
  const closing = updates.close()
  release.resolve()
  assert.deepEqual(await operation, { ok: false, reason: '桌面外壳更新已关闭' })
  await closing
  assert.equal(updates.status().readyVersion, null)
})

test('real signature worker forwards verifier errors and download can retry', { skip: process.platform !== 'win32' }, async () => {
  const updater = createUpdater()
  updater.checkForUpdates = async () => /** @type {any} */ ({ updateInfo: { version: '0.2.0' } })
  let downloads = 0
  updater.downloadUpdate = async () => {
    downloads++
    // 非字符串路径在依赖的 replace 调用处直接失败，不读取文件也不启动 PowerShell。
    await updater.verifyUpdateCodeSignature(['Publisher'], null)
    return []
  }
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await updates.download('0.2.0')
      assert.equal(result.ok, false)
      assert.match(result.reason, /replace/)
      assert.equal(updates.status().readyVersion, null)
    }
    assert.equal(downloads, 2, '签名失败后 busy 已释放，可以重新尝试')
  } finally {
    await updates.close()
  }
})
