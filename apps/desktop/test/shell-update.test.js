// @ts-check
/** 外壳更新的模式、下载返回值和关闭屏障；检查与下载均由本地桩控制。 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'

import { createShellUpdates, shellUpdateMode } from '../lib/shell-update.js'

/** 用显式释放控制检查和下载，不依赖网络或等待时长。 */
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('only installed Windows and writable AppImage builds offer in-app shell updates', () => {
  assert.equal(shellUpdateMode({ platform: 'win32', packaged: true }), 'automatic')
  assert.equal(shellUpdateMode({ platform: 'win32', packaged: true, portable: true }), 'portable')
  assert.equal(shellUpdateMode({ platform: 'linux', packaged: true, appImage: '/tmp/pig.AppImage' }), 'automatic')
  assert.equal(shellUpdateMode({ platform: 'linux', packaged: true }), 'manual')
  assert.equal(shellUpdateMode({ platform: 'darwin', packaged: true }), 'unsigned-mac')
  assert.equal(shellUpdateMode({ platform: 'win32', packaged: false }), 'development')
})

test('shell update checks the target shell version, downloads, and waits for restart', async () => {
  const updater = new EventEmitter()
  const calls = []
  updater.checkForUpdates = async () => { calls.push('check'); return { updateInfo: { version: '0.2.0' } } }
  updater.downloadUpdate = async () => { calls.push('download'); updater.emit('download-progress', { percent: 75 }) }
  updater.quitAndInstall = () => calls.push('restart')
  const progress = []
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater, onProgress: value => progress.push(value) })
  assert.deepEqual(await updates.download('0.2.0'), { ok: true, version: '0.2.0' })
  assert.deepEqual(calls, ['check', 'download'])
  assert.deepEqual(progress, [0.75])
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)
  assert.equal(updater.disableDifferentialDownload, true)
  assert.deepEqual(updates.status(), { mode: 'automatic', currentVersion: '0.1.3', readyVersion: '0.2.0' })
  assert.deepEqual(updates.install(), { ok: true })
  assert.deepEqual(calls, ['check', 'download', 'restart'])
})

for (const phase of ['check', 'download']) {
  for (const outcome of ['resolve', 'reject']) {
    test(`close waits for pending ${phase} to ${outcome} and finish cleanup`, async () => {
      const entered = deferred()
      const release = deferred()
      const updater = new EventEmitter()
      const calls = []
      let token
      updater.checkForUpdates = async () => {
        calls.push('check')
        if (phase === 'check') { entered.resolve(); await release.promise }
        return { updateInfo: { version: '0.2.0' } }
      }
      updater.downloadUpdate = async cancellation => {
        token = cancellation
        calls.push('download')
        cancellation.onCancel(() => calls.push('cancel'))
        entered.resolve()
        try { await release.promise } finally { calls.push('cleanup') }
      }
      updater.quitAndInstall = () => assert.fail('关闭后不能启动安装器')
      const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
      const operation = updates.download('0.2.0').then(result => { calls.push('finished'); return result })
      await entered.promise
      const closing = updates.close()
      closing.then(() => calls.push('closed'))
      try {
        assert.equal(updates.close(), closing, '重复关闭等待同一轮收尾')
        if (phase === 'download') assert.equal(token.cancelled, true)
        assert.deepEqual(await updates.download('0.3.0'), { ok: false, reason: '桌面外壳更新已关闭' })
        assert.equal(updates.install().ok, false)
        // 只让已就绪的微任务运行一轮，不靠超时判断悬挂操作是否结束。
        await setImmediate()
        assert.equal(calls.includes('closed'), false, '检查/下载仍挂起，close 不应提前完成')
      } finally {
        if (outcome === 'resolve') release.resolve()
        else release.reject(new Error(`${phase} failed`))
        await operation
        await closing
      }
      const result = await operation
      assert.equal(result.ok, false)
      assert.equal(result.reason, outcome === 'resolve' ? '桌面外壳更新已关闭' : `${phase} failed`)
      assert.equal(updates.status().readyVersion, null)
      assert.deepEqual(calls, phase === 'check' ? ['check', 'finished', 'closed'] : ['check', 'download', 'cancel', 'cleanup', 'finished', 'closed'])
      assert.equal(updates.install().ok, false)
    })
  }
}

test('close refuses installation even when an earlier download is ready', async () => {
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => ({ updateInfo: { version: '0.2.0' } })
  updater.downloadUpdate = async () => {}
  updater.quitAndInstall = () => assert.fail('关闭后不能启动已下载的安装器')
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  assert.deepEqual(await updates.download('0.2.0'), { ok: true, version: '0.2.0' })
  await updates.close()
  assert.equal(updates.install().ok, false)
})

test('close before the queued operation starts does not begin an update check', async () => {
  const updater = new EventEmitter()
  updater.checkForUpdates = () => assert.fail('关闭后不能再开始检查')
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  const operation = updates.download('0.2.0')
  await updates.close()
  assert.deepEqual(await operation, { ok: false, reason: '桌面外壳更新已关闭' })
  assert.equal(updates.status().readyVersion, null)
})

test('synchronous close inside an update check still waits for that operation', async () => {
  const entered = deferred()
  const release = deferred()
  const updater = new EventEmitter()
  let closing
  let closed = false
  updater.checkForUpdates = () => {
    closing = updates.close()
    closing.then(() => { closed = true })
    entered.resolve()
    return release.promise
  }
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  const operation = updates.download('0.2.0')
  await entered.promise
  try {
    await setImmediate()
    assert.equal(closed, false)
  } finally {
    release.resolve({ updateInfo: { version: '0.2.0' } })
    await operation
    await closing
  }
  assert.deepEqual(await operation, { ok: false, reason: '桌面外壳更新已关闭' })
  assert.equal(closed, true)
})

test('busy download is refused and a failed operation releases busy for retry', async () => {
  const release = deferred()
  const updater = new EventEmitter()
  let checks = 0
  updater.checkForUpdates = async () => {
    if (++checks === 1) await release.promise
    return { updateInfo: { version: '0.2.0' } }
  }
  updater.downloadUpdate = async () => {}
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  assert.equal((await updates.download('0.1.3')).ok, false)
  assert.equal(checks, 0)
  const first = updates.download('0.2.0')
  try {
    assert.deepEqual(await updates.download('0.2.0'), { ok: false, reason: '桌面外壳正在下载' })
  } finally {
    release.reject(new Error('check failed'))
    await first
  }
  assert.deepEqual(await first, { ok: false, reason: 'check failed' })
  assert.deepEqual(await updates.download('0.2.0', true), { ok: true, version: '0.2.0' })
  assert.equal(updater.allowPrerelease, true)
  assert.deepEqual(await updates.download('0.2.0'), { ok: true, version: '0.2.0' })
  assert.equal(checks, 2, '已下载的同版本不重新检查或下载')
  await updates.close()
})

test('a different published shell version never installs behind the requested release', async () => {
  const updater = new EventEmitter()
  updater.checkForUpdates = async () => ({ updateInfo: { version: '0.3.0' } })
  updater.downloadUpdate = async () => assert.fail('must not download the wrong release')
  const updates = createShellUpdates({ mode: 'automatic', currentVersion: '0.1.3', updater })
  assert.equal((await updates.download('0.2.0')).ok, false)
  assert.equal(updates.status().readyVersion, null)
})

test('portable and unsigned macOS remain download-only without loading an updater', async () => {
  for (const mode of ['portable', 'unsigned-mac', 'manual', 'development']) {
    const updates = createShellUpdates({ mode, currentVersion: '0.1.3' })
    assert.equal(updates.status().mode, mode)
    assert.equal((await updates.download('0.2.0')).ok, false)
    assert.equal(updates.install().ok, false)
  }
})

test('Gitee 渠道：按发行版 tag 把更新清单地址指到 Gitee 下载目录', async () => {
  const { CHANNEL } = await import('../../../channels/gitee.js')
  const calls = []
  const updater = {
    on() {}, setFeedURL(feed) { calls.push(['feed', feed]) },
    async checkForUpdates() { calls.push(['check']); return { updateInfo: { version: '0.4.0' } } },
    async downloadUpdate() { calls.push(['download']) },
  }
  const shell = createShellUpdates({ mode: 'automatic', currentVersion: '0.3.0', updater, channel: CHANNEL })
  assert.equal((await shell.download('0.4.0', false)).ok, false, '没有 tag 时不去猜地址')
  const result = await shell.download('0.4.0', false, 'v0.32.0')
  assert.equal(result.ok, true)
  assert.deepEqual(calls[0], ['feed', { provider: 'generic', url: 'https://gitee.com/clicgger/dsh-piggy/releases/download/v0.32.0' }])
})
