// @ts-check
/** 桌面 runtime 单写者 + N 会话：请求按 token 归属到猪，快照也带回同一 token。 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { createGameRuntime } from '../../../runtime/index.js'
import { inspectOwnerDocumentFile } from '../../../runtime/owner-document-file.js'
import { splitLegacyState } from '../../../store/legacy-projection.js'
import { startBackgroundHost } from '../lib/background-host.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const encode = value => new TextEncoder().encode(JSON.stringify(value)).buffer
const farm = () => ({ version: 6, plots: [{ plantedAt: Date.now() - 86_400_000, crop: 'apple' }], seeds: { apple: 4 }, harvest: {} })

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-multi-session-'))
  const ownerDocumentPath = join(directory, 'owner-document.json')
  const legacyStatePath = join(directory, 'legacy-state.json')
  const initialFarm = farm()
  const state = hatchEgg(Date.now() - 86_400_000)
  state.name = '甲'
  state.coins = 500
  state.inventory = { apple: 2 }
  state.extData = { farm: initialFarm }
  writeFileSync(legacyStatePath, JSON.stringify(state))
  // 用产品迁移和 addPigTarget 生成真实的两猪 owner 文档，而不是手写 JSON。
  const first = createGameRuntime({
    statePath: ownerDocumentPath, ownerDocumentPath, legacyStatePath,
    ownerId: 'owner-local', pigId: 'pig-a', now: () => Date.now(),
  })
  try {
    const bodyB = structuredClone(splitLegacyState(first.store.state).body)
    bodyB.name = '乙'
    bodyB.ageMs = 10 * 86_400_000
    first.addPigTarget('pig-b', bodyB)
  } finally { await first.dispose() }
  return { directory, ownerDocumentPath, farm: initialFarm }
}

test('一个 worker 开两个 pig 会话：请求/快照按 token 隔离，owner 资源共享', async t => {
  const f = await fixture()
  const snapshots = []
  let host
  try {
    host = await startBackgroundHost(ROOT, f.ownerDocumentPath, {
      ownerDocument: { ownerDocumentPath: f.ownerDocumentPath, ownerId: 'owner-local', pigId: 'pig-a' },
      workEventsAutoStart: false,
      onSnapshot: (value, session) => snapshots.push({ value, session }),
    })
    const read = async token => {
      const response = await host.handle('GET', '/dsh-piggy/state', undefined, token)
      assert.equal(response.status, 200)
      return JSON.parse(response.body)
    }

    const sessionA = await host.openPigSession('pig-a')
    const sessionB = await host.openPigSession('pig-b')
    assert.equal(sessionA.pigId, 'pig-a')
    assert.equal(sessionB.pigId, 'pig-b')
    assert.match(sessionA.token, /^[A-Za-z0-9_-]{40,}$/)
    assert.match(sessionB.token, /^[A-Za-z0-9_-]{40,}$/)
    assert.notEqual(sessionA.token, sessionB.token)

    const beforeA = await read(sessionA.token)
    const beforeB = await read(sessionB.token)
    assert.equal(beforeA.pig.name, '甲')
    assert.equal(beforeB.pig.name, '乙')
    assert.notEqual(beforeA.pig.ageDays, beforeB.pig.ageDays, '成长按猪隔离')
    assert.equal(beforeA.pig.coins, beforeB.pig.coins)
    assert.deepEqual(beforeA.inventory, beforeB.inventory)

    // 金币/背包是 owner 资源：在 A 买苹果，B 立刻看到同一份余额和背包。
    const bought = await host.handle('POST', '/dsh-piggy/act', encode({ action: 'buy', item: 'apple' }), sessionA.token)
    assert.equal(JSON.parse(bought.body).ok, true, bought.body)
    const afterBuyA = await read(sessionA.token)
    const afterBuyB = await read(sessionB.token)
    assert.equal(afterBuyA.pig.coins, afterBuyB.pig.coins)
    assert.ok(afterBuyA.pig.coins < beforeA.pig.coins)
    assert.equal(afterBuyA.inventory.apple, afterBuyB.inventory.apple)
    assert.equal(afterBuyA.inventory.apple, beforeA.inventory.apple + 1)

    // 对 B 的 act 只改 B 的本体，不碰 A，也不碰共享菜园。
    snapshots.length = 0
    const renamed = await host.handle('POST', '/dsh-piggy/act', encode({ action: 'name', name: '乙新' }), sessionB.token)
    assert.equal(JSON.parse(renamed.body).pig.name, '乙新')
    assert.equal((await read(sessionA.token)).pig.name, '甲')
    assert.equal((await read(sessionB.token)).pig.name, '乙新')

    // pending 快照只发给 B 的 token；默认会话仍可用。
    snapshots.length = 0
    const dev = await host.handle('POST', '/dsh-piggy/act', encode({ action: 'dev', patch: { say: 'eat' } }), sessionB.token)
    assert.equal(JSON.parse(dev.body).pending.filter(event => event.kind === 'line').length, 1)
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0].session, sessionB.token)
    assert.equal(JSON.parse(snapshots[0].value).pig.name, '乙新')
    assert.equal((await read(undefined)).pig.name, '甲', '无 token 仍走启动时的默认会话')

    // 未知/已关闭 token 必须被拒绝，不能静默落到默认猪。
    await assert.rejects(host.handle('GET', '/dsh-piggy/state', undefined, 'not-a-token'), /unknown or closed game session/)
    assert.deepEqual(await host.closePigSession(sessionB.token), { ok: true })
    await assert.rejects(host.handle('GET', '/dsh-piggy/state', undefined, sessionB.token), /unknown or closed game session/)
    await assert.rejects(host.closePigSession(sessionB.token), /unknown or closed game session/)
    await assert.rejects(host.openPigSession('pig-missing'), /pigId is not registered/)
    assert.equal((await read(sessionA.token)).pig.name, '甲', '关闭 B 不影响 A')

    assert.deepEqual(await host.dispose(), { saved: true })
    host = undefined
    const inspected = inspectOwnerDocumentFile(f.ownerDocumentPath)
    assert.equal(inspected.kind, 'owner-document')
    if (inspected.kind === 'owner-document') {
      const document = inspected.document
      assert.deepEqual(document.pigs.map(pig => pig.pigId), ['pig-a', 'pig-b'])
      assert.equal(document.pigs.find(pig => pig.pigId === 'pig-a')?.body.name, '甲')
      assert.equal(document.pigs.find(pig => pig.pigId === 'pig-b')?.body.name, '乙新')
      // 菜园归 owner：只有一份，且 B 的 act 没有改写它。
      assert.deepEqual(document.resources.extData?.farm, f.farm)
    }
  } finally {
    await host?.dispose()
    rmSync(f.directory, { recursive: true, force: true })
  }
})
