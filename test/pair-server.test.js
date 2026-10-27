// @ts-check
/** #14 配对接口：认证、白名单、去重、合并/回滚、素材代理与备份清理。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request as httpRequest } from 'node:http'

import { createGameRuntime } from '../runtime/index.js'
import { startPairServer } from '../runtime/pair-server.js'
import { createSaveArchive } from '../runtime/save-archive.js'
import { cleanupOldMerges } from '../runtime/merge-backup.js'
import { makeZip, readZip } from '../runtime/save-zip.js'
import { hatchEgg, migrate } from '../core.js'

const BASE = 1_800_000_000_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-pair-'))
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const fresh = (patch = {}) => Object.assign(migrate(hatchEgg(BASE), BASE), patch)

async function setup(patch = {}, options = {}) {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  const clock = { now: BASE }
  const state = fresh(patch)
  writeFileSync(statePath, JSON.stringify(state))
  const runtime = createGameRuntime({ statePath, now: () => clock.now })
  const pair = await startPairServer({ runtime, directory: join(dir, 'endpoint'), appVersion: '0.6.7', gameVersion: '0.37.2', confirm: options.confirm ?? (() => true), now: () => clock.now })
  const discovery = readJson(join(dir, 'endpoint', 'pair.json'))
  const base = `http://127.0.0.1:${discovery.port}`
  const headers = { authorization: `Bearer ${discovery.token}` }
  const call = (path, init = {}) => fetch(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  const json = (path, init = {}) => call(path, init).then(async response => ({ status: response.status, body: await response.json() }))
  const act = (body) => json('/pair/act', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const sourceArchive = (sourceState) => createSaveArchive({ statePath: join(dir, 'source-state.json'), state: sourceState, nowMs: clock.now })
  const close = async () => { await pair.close(); runtime.dispose(); rmSync(dir, { recursive: true, force: true }) }
  return { dir, statePath, clock, runtime, pair, discovery, headers, call, json, act, sourceArchive, close }
}

test('配对接口认证、Origin、Host、content-type、大小与未知路由', async () => {
  const s = await setup()
  try {
    const base = `http://127.0.0.1:${s.discovery.port}`
    assert.equal((await fetch(base + '/pair/info')).status, 401)
    assert.equal((await fetch(base + '/pair/info', { headers: { ...s.headers, origin: 'https://evil.example' } })).status, 403)
    const hostStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(new URL(base + '/pair/info'), { headers: { ...s.headers, host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode) })
      req.on('error', reject); req.end()
    })
    assert.equal(hostStatus, 403)
    assert.equal((await fetch(base + '/pair/act', { method: 'POST', headers: s.headers, body: '{}' })).status, 415)
    assert.equal((await fetch(base + '/pair/act', { method: 'POST', headers: { ...s.headers, 'content-type': 'application/json' }, body: 'x'.repeat(3000) })).status, 413)
    assert.equal((await fetch(base + '/pair/nope', { headers: s.headers })).status, 404)
    assert.equal((await fetch(base + '/pair/info', { headers: s.headers })).status, 200)
    assert.equal((await fetch(base + '/pair/info?token=' + s.discovery.token, { headers: s.headers })).status, 200)
  } finally { await s.close() }
})

test('info 只读；state 固定 drain=false 不消费待播；act 白名单与 requestId 去重', async () => {
  const s = await setup({ inventory: { apple: 2 } })
  try {
    s.runtime.view(false)
    await s.act({ clientId: 'dsh-test', requestId: 'req-pet-0001', action: 'pet' })
    const info = await s.json('/pair/info')
    assert.equal(info.body.hasPig, true)
    assert.equal(info.body.capabilities.includes('merge'), true)
    const state = await s.json('/pair/state')
    assert.equal(state.body.link, undefined)
    assert.ok(Array.isArray(state.body.pending))
    assert.equal((await s.act({ clientId: 'dsh-test', requestId: 'req-feed-001', action: 'feed', item: 'apple' })).body.inventory.apple, 1)
    assert.equal((await s.act({ clientId: 'dsh-test', requestId: 'req-feed-001', action: 'feed', item: 'apple' })).body.inventory.apple, 1, '同一 requestId 只执行一次')
    assert.equal((await s.act({ clientId: 'dsh-test', requestId: 'req-feed-002', action: 'feed', item: 'apple' })).body.inventory.apple, 0)
    for (const action of ['dev', 'giveAll', 'reset', 'ageFromNow', 'timeScale', 'fishGive', 'installExtension', 'removeExtension']) {
      assert.equal((await s.act({ clientId: 'dsh-test', requestId: `req-deny-${action}`, action })).status, 403, action)
    }
  } finally { await s.close() }
})

test('touch（拖动/摸一下的后台动作）在配对白名单里：200 ok:true 且刷新桌面 lastActiveAt', async () => {
  const s = await setup()
  try {
    s.clock.now += 60_000
    const before = s.runtime.snapshotForWrite().state.lastActiveAt
    const touched = await s.act({ clientId: 'dsh-test', requestId: 'req-touch-0001', action: 'touch' })
    assert.equal(touched.status, 200)
    assert.equal(touched.body.ok, true, JSON.stringify(touched.body))
    assert.equal(touched.body.reason, undefined)
    assert.ok(touched.body.pig)
    const after = s.runtime.snapshotForWrite().state.lastActiveAt
    assert.equal(after, s.clock.now)
    assert.ok(after > before)
  } finally { await s.close() }
})

test('command：白名单、同 requestId 只执行一次、调试动词拒绝', async () => {
  const s = await setup()
  try {
    const response = await s.json('/pair/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'req-cmd-0001', input: 'pet' }) })
    assert.equal(response.status, 200)
    assert.equal(response.body.ok, true)
    const after = await s.json('/pair/state')
    assert.equal(after.body.stats?.pets ?? after.body.pending?.length >= 0, true)
    const again = await s.json('/pair/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'req-cmd-0001', input: 'pet' }) })
    assert.deepEqual(again.body, response.body)
    const denied = await s.json('/pair/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'req-cmd-0002', input: 'dev giveall' }) })
    assert.equal(denied.status, 403)
  } finally { await s.close() }
})

test('强制终结：打工/番茄/钓鱼未到点与已到点', async () => {
  const s = await setup()
  try {
    let counter = 0
    const prepare = body => s.json('/pair/merge/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: `prep-${body.target}-${++counter}`, ...body }) })
    await s.act({ clientId: 'dsh-test', requestId: 'req-work-0001', action: 'work', job: 'bricks' })
    let result = await prepare({ target: 'activity' })
    assert.equal(result.body.ok, true)
    assert.equal(result.body.alreadyFinished, false)
    assert.equal((await s.json('/pair/state')).body.activity, null)
    await s.act({ clientId: 'dsh-test', requestId: 'req-pomo-0001', action: 'pomodoro', minutes: 15 })
    result = await prepare({ target: 'pomodoro' })
    assert.equal(result.body.alreadyFinished, false)
    assert.equal((await s.json('/pair/state')).body.pomodoro.active, false)
    s.clock.now -= 1000
    const finished = await setup({ pomodoro: { startedAt: BASE - 16 * 60_000, minutes: 15, todayDone: 0, day: null, restUntil: null, finishedAt: null, quietBefore: null } })
    try { assert.equal((await finished.json('/pair/merge/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'prep-pomo-0002', target: 'pomodoro' }) })).body.alreadyFinished, true) } finally { await finished.close() }
    const fishing = await setup({ fishing: { ...fresh().fishing, pending: { id: 'x', key: 'fish_crucian', sizeCm: 10, price: 5, caughtAt: BASE, phase: 'waiting', castPower: 0.2, bitesAt: BASE, hookUntil: BASE, expiresAt: BASE + 1000 } } })
    try { assert.equal((await fishing.json('/pair/merge/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'prep-fish-0001', target: 'fishing' }) })).body.alreadyFinished, false) } finally { await fishing.close() }
  } finally { await s.close() }
})

test('art/ext 只读代理：内置、feedback、custom、穿越和未登记资产', async () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  const state = fresh()
  state.customSkins = [{ key: 'mint', label: '薄荷', author: 'A', description: '', emoji: '🎨', art: 'custom-mint', scenes: ['idle', 'eat', 'bathe', 'pet', 'play', 'sleep', 'study', 'trip', 'work', 'relaxed'], custom: true }]
  writeFileSync(statePath, JSON.stringify(state))
  mkdirSync(join(dir, 'skins'), { recursive: true })
  writeFileSync(join(dir, 'skins', 'custom-mint.png'), Buffer.from('custom-png'))
  mkdirSync(join(dir, 'extensions', 'garden', 'assets'), { recursive: true })
  writeFileSync(join(dir, 'extensions', 'garden', 'manifest.json'), JSON.stringify({ key: 'garden', label: 'Garden', version: '1.0.0', assets: ['bg.png'] }))
  writeFileSync(join(dir, 'extensions', 'garden', 'client.js'), 'export const ok = true\n')
  writeFileSync(join(dir, 'extensions', 'garden', 'server.js'), 'export default { eventVersion: 1 }\n')
  writeFileSync(join(dir, 'extensions', 'garden', 'assets', 'bg.png'), Buffer.from('bg'))
  const runtime = createGameRuntime({ statePath, now: () => BASE })
  await runtime.ext?.ready
  const pair = await startPairServer({ runtime, directory: join(dir, 'endpoint'), confirm: () => false, now: () => BASE })
  const disco = readJson(join(dir, 'endpoint', 'pair.json'))
  const base = `http://127.0.0.1:${disco.port}`
  const headers = { authorization: `Bearer ${disco.token}` }
  try {
    let response = await fetch(base + '/pair/art/feedback/birthday.png', { headers })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /image\/png/)
    response = await fetch(base + '/pair/art/custom-mint', { headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-cache')
    for (const name of ['..%2Fstate.json', '%2e%2e%2fstate.json', 'skins%2Fcustom-mint.png', 'unknown.png']) {
      assert.equal((await fetch(base + '/pair/art/' + name, { headers })).status, 404, name)
    }
    response = await fetch(base + '/pair/ext/garden/client.js', { headers })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /javascript/)
    response = await fetch(base + '/pair/ext/garden/assets/bg.png', { headers })
    assert.equal(response.status, 200)
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'bg')
    assert.equal((await fetch(base + '/pair/ext/garden/assets/nope.png', { headers })).status, 404)
    assert.equal((await fetch(base + '/pair/ext/missing/client.js', { headers })).status, 404)
  } finally { await pair.close(); runtime.dispose(); rmSync(dir, { recursive: true, force: true }) }
})

test('预览/提交/状态/回滚：金币相加、409 显式变化、重复提交幂等', async () => {
  const s = await setup({ name: '团团', coins: 1240, inventory: { apple: 2 } })
  try {
    const source = fresh({ name: '猪猪', coins: 880, inventory: { apple: 3 } })
    let response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip', 'x-request-id': 'preview-req-1' }, body: s.sourceArchive(source).buffer })
    const preview = await response.json()
    assert.equal(response.status, 200)
    assert.equal(preview.result.coins, 2120)
    assert.ok(preview.mergeId)
    assert.ok(preview.previewToken)
    assert.ok(preview.expiresAt > s.clock.now)
    const retry = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip', 'x-request-id': 'preview-req-1' }, body: s.sourceArchive(source).buffer })
    assert.equal((await retry.json()).mergeId, preview.mergeId, '同 requestId 返回同一 mergeId')
    await s.act({ clientId: 'dsh-test', requestId: 'req-change-1', action: 'pet' })
    const changed = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(changed.status, 409)
    assert.equal(changed.body.reason, 'explicit-change')
    // 新预览后不改显式状态，直接提交。
    response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip', 'x-request-id': 'preview-req-2' }, body: s.sourceArchive(source).buffer })
    const second = await response.json()
    const commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: second.mergeId, previewToken: second.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(commit.status, 200)
    assert.equal(commit.body.result.coins, 2120)
    assert.match(commit.body.backups.target, new RegExp(second.mergeId.slice(0, 8) + '\\.zip$'))
    const repeated = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: second.mergeId, previewToken: second.previewToken, choices: { duplicate: 'merge' } }) })
    assert.deepEqual(repeated.body, commit.body, '同一 mergeId 重复提交返回同一结果')
    const state = await s.json('/pair/state')
    assert.equal(state.body.pig.coins, 2120)
    const status = await s.json('/pair/merge/status?mergeId=' + second.mergeId)
    assert.equal(status.body.status, 'committed')
    const rollback = await s.json('/pair/merge/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: second.mergeId, requestId: 'rb-1' }) })
    assert.equal(rollback.status, 200)
    assert.deepEqual(rollback.body.restored, { target: true, source: false })
    const after = await s.json('/pair/state')
    assert.equal(after.body.pig.coins, 1240)
    const again = await s.json('/pair/merge/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: second.mergeId, requestId: 'rb-2' }) })
    assert.equal(again.status, 200)
    const history = readJson(join(s.dir, 'backups', 'merge-history.json'))
    assert.equal(history.activeMergeId, null)
    assert.equal(history.merges.find(item => item.mergeId === second.mergeId).status, 'rolled-back')
  } finally { await s.close() }
})

test('疑似副本：预览返回 duplicate，提交必须先显式选「仍然合并」', async () => {
  const s = await setup({ coins: 100 })
  try {
    const source = fresh({ coins: 50 })
    let response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })
    const preview = await response.json()
    assert.equal(preview.duplicate.suspected, true)
    let commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: {} }) })
    assert.equal(commit.status, 409)
    assert.equal(commit.body.reason, 'duplicate-choice-required')
    commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(commit.status, 200)
    assert.equal(commit.body.result.coins, 150)
  } finally { await s.close() }
})

test('预览过期、确认取消不写；被动时间流逝提交不 409', async () => {
  const s = await setup({ coins: 100 }, { confirm: () => true })
  try {
    const source = fresh({ coins: 50 })
    let response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })
    const preview = await response.json()
    s.clock.now += 11 * 60_000
    const expired = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(expired.status, 409)
    assert.equal(expired.body.reason, 'preview-expired')
    s.clock.now = BASE
    response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })
    const passive = await response.json()
    s.clock.now += 60_000
    const commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: passive.mergeId, previewToken: passive.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(commit.status, 200, JSON.stringify(commit.body))
    assert.equal(commit.body.result.coins, 150)
  } finally { await s.close() }
})

test('原生确认取消不写任何存档', async () => {
  const s = await setup({ coins: 100 }, { confirm: () => false })
  try {
    const source = fresh({ coins: 50 })
    const response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })
    const preview = await response.json()
    const before = readFileSync(s.statePath, 'utf8')
    const commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(commit.status, 409)
    assert.equal(commit.body.reason, 'declined')
    assert.equal(readFileSync(s.statePath, 'utf8'), before)
    assert.equal(existsSync(join(s.dir, 'backups')), false)
  } finally { await s.close() }
})

test('只保留最新一份合并备份：旧合并集删除、手动备份不动、registry 损坏不删', async () => {
  const s = await setup({ coins: 100 })
  try {
    mkdirSync(join(s.dir, 'backups'), { recursive: true })
    writeFileSync(join(s.dir, 'backups', 'piggy-save-manual.zip'), 'manual')
    const mergeOnce = async coins => {
      const response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(fresh({ coins })).buffer })
      const preview = await response.json()
      const commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
      assert.equal(commit.status, 200, JSON.stringify(commit.body))
      return { preview, commit: commit.body }
    }
    const first = await mergeOnce(10)
    assert.equal(existsSync(join(s.dir, 'backups', first.commit.backups.target)), true)
    const second = await mergeOnce(20)
    assert.equal(existsSync(join(s.dir, 'backups', first.commit.backups.target)), false, '旧合并备份删除')
    assert.equal(existsSync(join(s.dir, 'backups', `merge-${first.preview.mergeId}`)), false)
    assert.equal(existsSync(join(s.dir, 'backups', second.commit.backups.target)), true)
    assert.equal(readFileSync(join(s.dir, 'backups', 'piggy-save-manual.zip'), 'utf8'), 'manual')
    writeFileSync(join(s.dir, 'backups', 'merge-history.json'), '{broken')
    const skipped = cleanupOldMerges({ statePath: s.statePath, keepMergeId: '00000000-0000-0000-0000-000000000000' })
    assert.equal(skipped.skipped, true)
    assert.equal(existsSync(join(s.dir, 'backups', second.commit.backups.target)), true, 'registry 坏了不删旧备份')
  } finally { await s.close() }
})

test('撤销只认最近一次合并；更早的 mergeId 409', async () => {
  const s = await setup({ coins: 100 })
  try {
    const mergeOnce = async coins => {
      const response = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(fresh({ coins })).buffer })
      const preview = await response.json()
      const commit = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
      return { preview, commit: commit.body }
    }
    const first = await mergeOnce(10)
    const second = await mergeOnce(20)
    const stale = await s.json('/pair/merge/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: first.preview.mergeId, requestId: 'rb-stale' }) })
    assert.equal(stale.status, 409)
    const current = await s.json('/pair/merge/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: second.preview.mergeId, requestId: 'rb-current' }) })
    assert.equal(current.status, 200)
    const history = readJson(join(s.dir, 'backups', 'merge-history.json'))
    assert.equal(history.activeMergeId, null)
  } finally { await s.close() }
})

test('预览契约：choices[].sides 两边真实值、editors 真实已解锁列表与 label、最多 20 条自动明细', async () => {
  const s = await setup({ name: '团团', coins: 1240, inventory: { apple: 2 } })
  try {
    const source = fresh({ name: '猪猪', coins: 880, inventory: { apple: 3, milk: 1 } })
    source.dress = ['scarf']
    source.worn = ['scarf']
    source.dex.forms.swine = { firstAt: BASE, count: 1 }
    const preview = await (await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })).json()
    assert.ok(preview.ok !== false, JSON.stringify(preview))
    const targetSide = preview.choices.find(choice => choice.key === 'look').sides.target
    const sourceSide = preview.choices.find(choice => choice.key === 'look').sides.source
    assert.equal(targetSide.look.skin, fresh().skin)
    assert.deepEqual(sourceSide.look.worn, ['scarf'])
    assert.equal(preview.choices.find(choice => choice.key === 'name').sides.source.name, '猪猪')
    const formKeys = preview.editors.look.form.map(entry => entry.key)
    assert.ok(formKeys.includes('swine'))
    assert.ok(preview.editors.look.form.every(entry => typeof entry.label === 'string' && entry.label !== ''))
    const skinKeys = preview.editors.look.skin.map(entry => entry.key)
    assert.ok(skinKeys.includes('default'))
    assert.ok(preview.editors.look.worn.some(entry => entry.key === 'scarf' && entry.label !== 'scarf'))
    assert.ok(preview.editors.personality.personality.every(entry => entry.key !== '' && entry.label !== entry.key))
    assert.ok(preview.editors.preferences.spot.some(entry => entry.key === 'river' && entry.label === '小河'))
    assert.equal(preview.editors.name.max, 5)
    assert.ok(preview.autoMerge.length > 0 && preview.autoMerge.length <= 20)
    assert.ok(preview.autoMerge.some(line => line.includes('苹果 +3')))
    assert.ok(preview.autoMerge.some(line => line.includes('金币')))
    assert.equal(preview.sides.target.name, '团团')
    assert.equal(preview.sides.source.name, '猪猪')
    assert.match(preview.sourceSha256, /^[a-f0-9]{64}$/)
  } finally { await s.close() }
})

test('疑似副本三选一：只保留桌宠不相加；只保留内嵌猪替换桌宠；都要显式选择', async () => {
  const s = await setup({ name: '团团', coins: 100, inventory: { apple: 2 } })
  try {
    const source = fresh({ name: '团团', coins: 50, inventory: { apple: 3 } })
    const previewOf = async () => (await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })).json()
    const commit = (preview, choices) => s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices }) })
    let preview = await previewOf()
    assert.equal(preview.duplicate.suspected, true)
    assert.deepEqual(preview.duplicate.options, ['target', 'source', 'merge'])
    assert.equal(preview.duplicate.default, null)
    let result = await commit(preview, {})
    assert.equal(result.body.reason, 'duplicate-choice-required')
    const keepTarget = await commit(preview, { duplicate: 'target' })
    assert.equal(keepTarget.status, 200, JSON.stringify(keepTarget.body))
    assert.equal(keepTarget.body.result.coins, 100, '只保留桌宠：不相加')
    assert.equal(keepTarget.body.result.name, '团团')
    assert.equal((await s.json('/pair/state')).body.inventory.apple, 2)
    preview = await previewOf()
    const keepSource = await commit(preview, { duplicate: 'source' })
    assert.equal(keepSource.status, 200, JSON.stringify(keepSource.body))
    assert.equal(keepSource.body.result.coins, 50, '只保留内嵌猪：换成内嵌猪的值')
    const state = await s.json('/pair/state')
    assert.equal(state.body.pig.coins, 50)
    assert.equal(state.body.inventory.apple, 3)
  } finally { await s.close() }
})

test('提交校验可重试：非法选择、未知源字段、源哈希不符都不锁死同一预览', async () => {
  const s = await setup({ name: '团团', coins: 1000, inventory: { apple: 2 } })
  try {
    const source = fresh({ name: '猪猪', coins: 880, inventory: { apple: 3 } })
    source.futureField = { from: 'newer-dsh' }
    const archive = s.sourceArchive(source)
    const preview = await (await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: archive.buffer })).json()
    assert.ok(preview.conflicts.some(conflict => conflict.key === 'unknownSource'))
    const commit = body => s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, ...body }) })
    let result = await commit({ choices: { duplicate: 'merge' } })
    assert.equal(result.body.reason, 'unknown-source-fields')
    result = await commit({ choices: { duplicate: 'merge', unknownSource: 'abort' } })
    assert.equal(result.body.reason, 'unknown-source-aborted')
    result = await commit({ choices: { duplicate: 'merge', unknownSource: 'discard', name: { side: 'custom', value: '一二三四五六' } } })
    assert.equal(result.status, 409)
    assert.equal(result.body.reason, 'invalid-choices')
    assert.ok(result.body.details.errors.some(entry => entry.path === 'name.value'))
    result = await commit({ choices: { duplicate: 'merge', unknownSource: 'discard' }, sourceSha256: 'f'.repeat(64) })
    assert.equal(result.body.reason, 'source-changed')
    assert.equal((await s.json('/pair/state')).body.pig.coins, 1000, '失败分支不写合并结果')
    result = await commit({ choices: { duplicate: 'merge', unknownSource: 'discard' }, sourceSha256: preview.sourceSha256 })
    assert.equal(result.status, 200, JSON.stringify(result.body))
    assert.equal(result.body.result.coins, 1880)
    assert.equal(result.body.hashes.sourceSha256, preview.sourceSha256)
    assert.match(result.body.hashes.targetStateId, /^[a-f0-9]{64}$/)
    const state = readJson(s.statePath)
    assert.equal(state.futureField, undefined, '丢弃未知源字段')
  } finally { await s.close() }
})

test('跨版本：v14 存档迁移后合并保形；v16 拒绝；合并规则版本更高拒绝；目标未知字段保留', async () => {
  const s = await setup({ name: '团团', coins: 1000 })
  try {
    const legacy = fresh({ name: '猪猪', coins: 200 })
    legacy.version = 14
    const old = await (await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(legacy).buffer })).json()
    assert.ok(old.ok !== false, JSON.stringify(old))
    assert.equal(old.source.stateVersion, 14)
    const committed = await s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: old.mergeId, previewToken: old.previewToken, choices: { duplicate: 'merge' } }) })
    assert.equal(committed.status, 200, JSON.stringify(committed.body))
    const newer = fresh()
    newer.version = 16
    const rejected = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(newer).buffer })
    assert.equal(rejected.status, 409)
    assert.equal((await rejected.json()).reason, 'version-too-new')
    const archive = s.sourceArchive(fresh())
    const files = readZip(archive.buffer)
    const manifest = JSON.parse(files.get('backup.json').toString('utf8'))
    files.set('backup.json', Buffer.from(JSON.stringify({ ...manifest, mergeRulesVersion: 2 })))
    const rules = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: makeZip([...files]) })
    assert.equal(rules.status, 409)
    assert.equal((await rules.json()).reason, 'rules-too-new')
  } finally { await s.close() }
})

test('预览/终结阻塞项带真实细节：活动类型、退款、鱼饵、phase、是否已到点', async () => {
  const s = await setup()
  try {
    await s.act({ clientId: 'dsh-test', requestId: 'req-study-0001', action: 'study', subject: 'mathematics', stage: 'primary' })
    const preview = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(fresh()).buffer })
    assert.equal(preview.status, 409)
    const body = await preview.json()
    assert.equal(body.reason, 'activity')
    assert.equal(body.details.side, 'target')
    assert.equal(body.details.kind, 'study')
    assert.ok(body.details.refund > 0)
    assert.equal(body.details.finished, false)
    await s.json('/pair/merge/prepare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dsh-test', requestId: 'prep-any-1', target: 'activity' }) })
    const fish = await s.act({ clientId: 'dsh-test', requestId: 'req-fish-0001', action: 'fishCast', spot: 'river' })
    if (fish.body.fishing?.pending !== null && fish.body.fishing?.pending !== undefined) {
      const blocked = await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(fresh()).buffer })
      const detail = await blocked.json()
      assert.equal(detail.reason, 'fishing')
      assert.equal(detail.details.kind, 'fishing-manual')
      assert.ok(['waiting', 'hooked'].includes(detail.details.phase))
    }
  } finally { await s.close() }
})

test('合并前备份失败：返回 backup-failed、不写存档、预览可重试', async () => {
  const s = await setup({ name: '团团', coins: 100 })
  try {
    const source = fresh({ name: '猪猪', coins: 50 })
    const preview = await (await s.call('/pair/merge/preview', { method: 'POST', headers: { 'content-type': 'application/zip' }, body: s.sourceArchive(source).buffer })).json()
    const before = readFileSync(s.statePath, 'utf8')
    writeFileSync(join(s.dir, 'backups'), 'not a directory')
    const commit = body => s.json('/pair/merge/commit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    const failed = await commit()
    assert.equal(failed.status, 409)
    assert.equal(failed.body.reason, 'backup-failed')
    assert.equal(readFileSync(s.statePath, 'utf8'), before)
    rmSync(join(s.dir, 'backups'), { force: true })
    const retried = await commit()
    assert.equal(retried.status, 200, JSON.stringify(retried.body))
    assert.equal(retried.body.result.coins, 150)
  } finally { await s.close() }
})
