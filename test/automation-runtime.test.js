// @ts-check
/** 帮工的事务和删除用真实扩展宿主，不能越过钱包或留下宿主脏字段。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import mine from '../extensions/mine/server.js'
import farm from '../extensions/farm/server.js'
import { setupExtensions } from './helpers/extension-achievements.js'

test('帮工动作失败整笔撤回；删除只清自己的帮工和仓、按汇率结清钱包', async () => {
  const run = await setupExtensions({ mine: mine.init(), farm: farm.init() })
  try {
    run.store.mutate(state => { state.wallets.mine.balance = 10000; state.wallets.farm.balance = 10000; return { ok: true } })
    assert.equal(run.runtime.act('mine', 'hire', {}).ok, true)
    assert.equal(run.runtime.act('farm', 'hire', {}).ok, true)
    const before = structuredClone(run.store.state)
    assert.equal(run.runtime.act('mine', 'workerFloor', { floor: 16 }).reason, 'locked')
    assert.deepEqual(run.store.state, before)
    const coins = run.store.state.coins, wallet = run.store.state.wallets.mine.balance
    assert.equal(run.runtime.remove('mine').ok, true)
    assert.equal(run.store.state.extData.mine, undefined)
    assert.equal(run.store.state.wallets.mine, undefined)
    assert.equal(run.store.state.coins, coins + wallet)
    assert.equal(run.store.state.extData.farm.helper.hired, true)
    assert.equal(run.store.state.wallets.farm.balance, 7500)
  } finally { run.dispose() }
})
