// @ts-check
/** 执行真实 main 更新协调闭包，以受控版本服务、保存和重启边界核对取消、恢复及多窗口排他。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shellLifecycle } from './helpers/shell-lifecycle.js'

function deferred() {
  /** @type {(value?: any) => void} */
  let resolve
  /** @type {(error: Error) => void} */
  let reject
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const target = { version: '0.38.0', blocked: null, manifest: { stateVersion: 14 }, packUrl: 'fixture-game' }

test('准备期间退出只取消准备；迟到令牌不提交，保存失败后恢复版本服务并可重试安装', { timeout: 5000 }, async () => {
  const preparation = deferred(), cancellation = deferred(), discardEntered = deferred(), discardFinished = deferred()
  const saveEntered = deferred(), saveFinished = deferred(), retrySaveEntered = deferred(), retrySaveFinished = deferred()
  const cancelledToken = { id: 1, version: target.version }, retryToken = { id: 2, version: target.version }
  const saveError = new Error('测试注入：退出保存被阻挡')
  const calls = { prepare: 0, cancel: 0, close: 0, dispose: 0, list: 0, committed: [], discarded: [] }
  let isClosed = false, active = '0.37.0'
  const versions = {
    async list() { assert.equal(isClosed, false); calls.list++; return [target] },
    async prepareInstall(release, onProgress) {
      assert.equal(isClosed, false)
      assert.equal(release, target)
      calls.prepare++
      onProgress(0.5)
      return calls.prepare === 1 ? preparation.promise : retryToken
    },
    async cancelPreparation() { calls.cancel++; await cancellation.promise },
    async discardPrepared(token) {
      assert.equal(token, cancelledToken)
      calls.discarded.push(token)
      discardEntered.resolve()
      await discardFinished.promise
    },
    async commitInstall(token) {
      assert.equal(isClosed, false)
      assert.equal(token, retryToken, '取消之后迟到的准备结果不能切 active')
      calls.committed.push(token)
      active = token.version
      return { ok: true, version: active }
    },
    async close() { calls.close++; isClosed = true },
  }
  const lifecycle = shellLifecycle({ dispose() {
    calls.dispose++
    if (calls.dispose === 1) { saveEntered.resolve(); return saveFinished.promise }
    assert.equal(calls.dispose, 2, '重试和重启必须共用一次保存')
    retrySaveEntered.resolve()
    return retrySaveFinished.promise
  } }, undefined, { versions })
  assert.equal((await lifecycle.request('piggy:updates:list')).ok, true)
  const installing = lifecycle.request('piggy:updates:install', [target.version])
  assert.deepEqual(lifecycle.notifications, [['pet', 'piggy:progress', 0.5], ['panel', 'piggy:progress', 0.5]])
  assert.equal(lifecycle.state().action.phase, 'prepare')
  assert.equal(lifecycle.quit(), null, '准备预约尚未释放，不能开始退出保存')
  assert.equal(calls.cancel, 1)
  assert.equal(calls.close, 0)
  assert.equal(calls.dispose, 0)
  assert.equal(lifecycle.state().action.cancelled, true)
  assert.equal(lifecycle.state().quitting, true)
  assert.equal((await lifecycle.request('piggy:updates:install', [target.version], 'panel')).ok, false)
  // 模拟取消指令与已生成的准备结果交叉到达；生产协调器仍须丢弃迟到令牌。
  preparation.resolve(cancelledToken)
  await discardEntered.promise
  assert.equal(calls.dispose, 0, '撤销未结束前不能释放预约并退出')
  assert.equal(lifecycle.state().action.cancelled, true)
  assert.deepEqual(calls.committed, [])
  cancellation.resolve()
  discardFinished.resolve()
  const cancelled = await installing
  assert.equal(cancelled.ok, false)
  assert.match(cancelled.reason, /已取消版本准备/)
  await saveEntered.promise
  const quitting = lifecycle.waitForQuit()
  assert.equal(lifecycle.state().action, null)
  assert.equal(calls.close, 0)
  saveFinished.reject(saveError)
  await quitting
  assert.equal(lifecycle.state().quitting, false)
  assert.equal(lifecycle.state().closing, false)
  assert.equal(lifecycle.state().closed, false)
  assert.equal(lifecycle.state().shellClosed, false)
  assert.equal(lifecycle.state().hitTimer, 1)
  assert.equal(lifecycle.state().exits, 0)
  assert.equal(lifecycle.state().quitAfterAction, false)
  assert.equal(lifecycle.state().action, null)
  assert.equal(lifecycle.state().scheduled, 0)
  assert.equal(lifecycle.waitForQuit(), null)
  assert.equal(calls.dispose, 1, '失败后不能自动重复保存')
  assert.equal(calls.close, 0, '保存失败不能永久关闭版本服务')
  assert.equal(active, '0.37.0')
  assert.deepEqual(calls.discarded, [cancelledToken])
  assert.deepEqual(calls.committed, [])
  assert.deepEqual(lifecycle.backups, [])
  assert.ok(lifecycle.messages.some(parts => parts[0] === 'host shutdown failed' && parts[1] === String(saveError)))
  assert.equal((await lifecycle.request('piggy:updates:list', [true], 'panel')).ok, true)
  assert.equal(calls.list, 2, '恢复后真实列表 handler 仍调用同一个版本服务')
  const retrying = lifecycle.request('piggy:updates:install', [target.version], 'panel')
  await retrySaveEntered.promise
  assert.deepEqual(calls.committed, [])
  retrySaveFinished.resolve({ saved: true })
  assert.equal((await retrying).ok, true)
  assert.equal(calls.prepare, 2)
  assert.deepEqual(calls.committed, [retryToken])
  assert.equal(active, target.version)
  assert.deepEqual(lifecycle.backups, ['v' + target.version])
  assert.equal(calls.close, 0, '激活后仍等实际重启边界才关闭版本服务')
  assert.equal(lifecycle.state().scheduled, 1)
  await lifecycle.runScheduled()
  assert.equal(calls.dispose, 2)
  assert.equal(calls.cancel, 1)
  assert.equal(calls.close, 1)
  assert.equal(lifecycle.state().exits, 1)
  assert.equal(lifecycle.state().relaunches, 1)
  assert.equal(lifecycle.state().scheduled, 0)
  assert.deepEqual(lifecycle.dialogs, [])
})

test('保存与提交阶段退出和另一窗口请求保持排他，只保存、备份和提交一次后退出', { timeout: 5000 }, async () => {
  const preparation = deferred(), saveEntered = deferred(), saveFinished = deferred()
  const commitEntered = deferred(), commitFinished = deferred()
  const prepared = { id: 1, version: target.version }, steps = []
  const calls = { prepare: 0, dispose: 0, commit: 0, current: 0, rollback: 0, cancel: 0, close: 0, discard: 0 }
  let active = '0.37.0'
  const versions = {
    async list() { return [target] },
    async prepareInstall(release) { assert.equal(release, target); calls.prepare++; return preparation.promise },
    async current() { calls.current++; return { previous: '0.36.0' } },
    async rollback() { calls.rollback++; active = '0.36.0'; return { ok: true, version: active } },
    async cancelPreparation() { calls.cancel++ },
    async discardPrepared() { calls.discard++ },
    async commitInstall(token) {
      assert.equal(token, prepared)
      calls.commit++
      steps.push('commit-entered')
      commitEntered.resolve()
      await commitFinished.promise
      active = token.version
      steps.push('committed')
      return { ok: true, version: active }
    },
    async close() { calls.close++; steps.push('versions-closed') },
  }
  const lifecycle = shellLifecycle({ async dispose() {
    calls.dispose++
    steps.push('saving')
    saveEntered.resolve()
    await saveFinished.promise
    steps.push('saved')
    return { saved: true }
  } }, undefined, { versions, backupSave: label => steps.push('backup:' + label) })
  assert.equal((await lifecycle.request('piggy:updates:list')).ok, true)
  const installing = lifecycle.request('piggy:updates:install', [target.version])
  // 页面尚可收消息时，两窗口也只能共用一个 prepare 预约。
  const concurrentInstall = await lifecycle.request('piggy:updates:install', [target.version], 'panel')
  const concurrentRollback = await lifecycle.request('piggy:updates:rollback', [], 'panel')
  assert.match(concurrentInstall.reason, /正在切换版本/)
  assert.match(concurrentRollback.reason, /正在切换版本/)
  assert.equal(concurrentInstall.ok, false)
  assert.equal(concurrentRollback.ok, false)
  preparation.resolve(prepared)
  await saveEntered.promise
  assert.equal(lifecycle.state().action.phase, 'commit')
  assert.equal(lifecycle.state().quitting, true)
  assert.equal(lifecycle.quit(), null)
  assert.equal(lifecycle.state().quitAfterAction, true)
  assert.equal(lifecycle.state().action.cancelled, false)
  assert.equal((await lifecycle.request('piggy:updates:install', [target.version], 'panel')).ok, false)
  assert.equal((await lifecycle.request('piggy:updates:rollback', [], 'panel')).ok, false)
  assert.equal(calls.dispose, 1)
  assert.equal(calls.commit, 0)
  assert.equal(calls.cancel, 0)
  assert.equal(calls.close, 0)
  assert.deepEqual(lifecycle.backups, [])
  assert.equal(active, '0.37.0')
  saveFinished.resolve()
  await commitEntered.promise
  assert.equal(lifecycle.state().action.phase, 'commit')
  assert.equal(lifecycle.quit(), null, 'commit 未完成时不能并发启动退出任务')
  assert.equal((await lifecycle.request('piggy:updates:rollback', [], 'panel')).ok, false)
  assert.equal(active, '0.37.0', 'commit 尚未完成，不能提前切换 active')
  assert.equal(calls.dispose, 1)
  assert.equal(calls.commit, 1)
  assert.equal(calls.close, 0)
  commitFinished.resolve()
  const installed = await installing
  assert.equal(installed.ok, true)
  assert.equal(installed.version, target.version)
  assert.equal(active, target.version)
  assert.equal(lifecycle.state().scheduled, 1)
  assert.equal(lifecycle.state().exits, 0)
  assert.equal((await lifecycle.request('piggy:updates:install', [target.version], 'panel')).ok, false)
  await lifecycle.runScheduled()
  assert.deepEqual(calls, { prepare: 1, dispose: 1, commit: 1, current: 0, rollback: 0, cancel: 0, close: 1, discard: 0 })
  assert.deepEqual(steps, ['saving', 'saved', 'backup:v' + target.version, 'commit-entered', 'committed', 'versions-closed'])
  assert.equal(active, target.version)
  assert.equal(lifecycle.state().exits, 1)
  assert.equal(lifecycle.state().relaunches, 0, '已请求退出，不应重新启动游戏')
  assert.equal(lifecycle.state().scheduled, 0)
  assert.equal(lifecycle.state().closed, true)
  assert.equal(lifecycle.state().shellClosed, true)
  assert.deepEqual(lifecycle.dialogs, [])
  assert.deepEqual(lifecycle.messages, [])
})
