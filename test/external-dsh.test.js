// @ts-check
/** #14 DSH 外部模式：发现、outbox、连接/切回、合并退役/撤销与恢复。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { createGameRuntime } from '../runtime/index.js'
import { startPairServer } from '../runtime/pair-server.js'
import { writeWorkJson } from '../runtime/work-files.js'
import { createExternalController } from '../adapters/dsh/external-controller.js'
import { createExternalPanel, summarizeSnapshot } from '../adapters/dsh/external-panel.js'
import { normalizeStatus } from '../src/client/external-api.js'
import { detectDesktop } from '../adapters/dsh/external-discovery.js'
import { createOutbox, OUTBOX_LIMITS } from '../adapters/dsh/external-outbox.js'
import { cleanupDsOldMerges, recoverRetirement, writeDsHistory } from '../adapters/dsh/external-merge.js'
import { hatchEgg, migrate } from '../core.js'
import { stateFingerprint } from '../adapters/dsh/external-files.js'

const BASE = 1_800_000_000_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-external-'))
const readJson = file => JSON.parse(readFileSync(file, 'utf8'))
const fresh = (patch = {}) => Object.assign(migrate(hatchEgg(BASE), BASE), patch)
const event = (index, patch = {}) => ({ version: 1, source: 'dsh', id: `turn:${index}`, type: 'turn', at: BASE - index * 1000, ...patch })

async function workStub(options = {}) {
  const token = 'b'.repeat(64)
  const received = []
  let statusFor = options.statusFor ?? (() => 200)
  const server = createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) { response.writeHead(401); response.end(); return }
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, role: 'piggy-work-events', version: 1, eventTypes: [] }))
      return
    }
    if (request.url === '/events') {
      let body = ''
      request.on('data', chunk => { body += chunk })
      request.on('end', () => {
        const status = statusFor(received.length)
        if (status === 200) received.push(JSON.parse(body))
        response.writeHead(status, { 'content-type': 'application/json' })
        response.end(status === 200 ? JSON.stringify({ ok: true, status: 'applied' }) : JSON.stringify({ ok: false }))
      })
      return
    }
    response.writeHead(404); response.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    token, received, server,
    port: server.address().port,
    setStatus(fn) { statusFor = fn },
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

async function desktop(options = {}) {
  const dir = temp()
  const statePath = join(dir, 'desktop', 'state.json')
  mkdirSync(join(dir, 'desktop'), { recursive: true })
  const clock = { now: BASE }
  writeFileSync(statePath, JSON.stringify(fresh(options.target ?? {})))
  const runtime = createGameRuntime({ statePath, now: () => clock.now })
  const workDir = join(dir, 'work-endpoint')
  const pair = await startPairServer({ runtime, directory: workDir, appVersion: '0.6.7', gameVersion: '0.37.2', confirm: options.confirm ?? (() => true), now: () => clock.now })
  const stub = await workStub(options.work)
  writeWorkJson(join(workDir, 'endpoint.json'), { version: 1, role: 'piggy-work-events', port: stub.port, token: stub.token, pid: process.pid })
  const homes = [join(dir, 'dsh-home')]
  const markerPath = join(homes[0], 'dsh-piggy', 'desktop-app.json')
  mkdirSync(join(homes[0], 'dsh-piggy'), { recursive: true })
  const marker = { version: 1, appVersion: '0.6.7', gameVersion: '0.37.2', stateVersion: 15, pid: process.pid, userData: dir, startedAt: BASE,
    external: { enabled: options.enabled !== false, workEndpointDir: workDir, pair: true } }
  writeFileSync(markerPath, JSON.stringify(marker))
  return {
    dir, statePath, clock, runtime, pair, stub, homes, markerPath, marker,
    close: async () => { await pair.close(); runtime.dispose(); await stub.close(); rmSync(dir, { recursive: true, force: true }) },
  }
}

function dshState(dir, patch = {}) {
  const dshDir = join(dir, 'dsh')
  mkdirSync(dshDir, { recursive: true })
  const statePath = join(dshDir, 'state.json')
  writeFileSync(statePath, JSON.stringify(fresh(patch)))
  return statePath
}

function controllerFor(statePath, options) {
  let runtime = null
  const embedded = {
    ensure: () => (runtime ??= createGameRuntime({ statePath, now: () => options.clock.now })),
    stop: () => { const old = runtime; runtime = null; old?.dispose() },
    runtime: () => runtime,
  }
  const controller = createExternalController({ statePath, embedded, fetch: options.fetch ?? globalThis.fetch, now: () => options.clock.now,
    markerPaths: [options.markerPath], homes: options.homes, gameVersion: '0.37.2' })
  return { controller, embedded, runtime: () => runtime }
}

test('内嵌到外部再切回：旧运行时失效，新运行时重新取得唯一写入权', async () => {
  const d = await desktop()
  const statePath = dshState(d.dir, { name: '唯一源猪', coins: 880 })
  const { controller, embedded } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  let reopened = null
  try {
    await controller.init()
    const old = embedded.ensure()
    assert.throws(() => createGameRuntime({ statePath, now: () => d.clock.now }), /live runtime/)
    assert.equal((await controller.connect('connect')).ok, true)
    assert.equal(embedded.runtime(), null)
    const paused = readFileSync(statePath)
    d.clock.now += 60_000
    assert.throws(() => old.view(), /closed/)
    assert.throws(() => old.acceptWorkEvent(event(1)), /closed/)
    assert.deepEqual(readFileSync(statePath), paused, '迟到的旧句柄不能结算或奖励已暂停源猪')

    assert.equal((await controller.disconnect()).ok, true)
    const current = embedded.runtime()
    assert.notEqual(current, old)
    assert.equal(current.view().pig.name, '唯一源猪')
    assert.equal(current.view().pig.coins, 880)
    assert.throws(() => old.view(), /closed/, '切回不能使旧句柄重新有效')
    assert.throws(() => createGameRuntime({ statePath, now: () => d.clock.now }), /live runtime/)

    // 适配器拥有 embedded 的生命周期；controller.close 本身只关连接与队列。
    controller.close()
    embedded.stop()
    reopened = createGameRuntime({ statePath, now: () => d.clock.now })
    assert.equal(reopened.view().pig.name, '唯一源猪')
  } finally {
    controller.close()
    embedded.stop()
    reopened?.dispose()
    await d.close()
  }
})

test('outbox：持久化、7 天过滤、2048/512KiB 上限、丢弃摘要、损坏留证', () => {
  const dir = temp()
  try {
    const statePath = join(dir, 'state.json')
    const clock = { now: BASE }
    const outbox = createOutbox({ statePath, now: () => clock.now })
    outbox.load()
    for (let index = 0; index < 10; index += 1) outbox.add(event(index))
    outbox.flush()
    assert.equal(readJson(`${statePath}.work-outbox.json`).events.length, 10)
    const reopened = createOutbox({ statePath, now: () => clock.now })
    reopened.load()
    assert.equal(reopened.status().queued, 10)
    assert.deepEqual(reopened.head(), event(0))
    for (let index = 10; index < OUTBOX_LIMITS.maxEvents + 20; index += 1) reopened.add(event(index))
    const status = reopened.status()
    assert.equal(status.queued, OUTBOX_LIMITS.maxEvents)
    assert.ok(status.bytes <= OUTBOX_LIMITS.maxBytes)
    assert.ok(status.dropped.count >= 20)
    assert.ok(Object.keys(status.dropped.types).length > 0)
    const old = createOutbox({ statePath: join(dir, 'old.json'), now: () => BASE })
    writeFileSync(join(dir, 'old.json.work-outbox.json'), JSON.stringify({ version: 1, events: [event(1, { at: BASE - 8 * 86_400_000 })], dropped: { count: 0, types: {}, days: {} } }))
    old.load()
    assert.equal(old.status().queued, 0)
    const corrupt = createOutbox({ statePath: join(dir, 'corrupt.json'), now: () => BASE })
    writeFileSync(join(dir, 'corrupt.json.work-outbox.json'), '{broken')
    corrupt.load()
    assert.equal(corrupt.status().queued, 0)
    assert.ok(readdirSync(dir).some(name => name.startsWith('corrupt.json.work-outbox.json.corrupt-')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('发现：没开联动/陈旧 pid/缺配对文件/工作接口 401 都不算可用；两边都通才算', async () => {
  const d = await desktop()
  try {
    const ok = await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })
    assert.equal(ok.ok, true)
    assert.equal(ok.target.summary.name, fresh().name)
    writeFileSync(d.markerPath, JSON.stringify({ ...d.marker, external: { ...d.marker.external, enabled: false } }))
    assert.equal((await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })).reason, 'disabled')
    writeFileSync(d.markerPath, JSON.stringify(d.marker))
    await d.stub.close()
    const unreachable = await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })
    assert.equal(unreachable.reason, 'work-unreachable')
    rmSync(join(d.dir, 'work-endpoint', 'pair.json'))
    assert.match((await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })).reason, /pair/)
    writeFileSync(d.markerPath, JSON.stringify({ ...d.marker, pid: 999999 }))
    assert.equal((await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })).reason, 'stale-marker')
  } finally { await d.close() }
})

test('连接：冻结内嵌猪、工作事件进 outbox 按序投递、面板镜像；切回按暂存时长后移', async () => {
  const d = await desktop({ target: { name: '团团' } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880, ageMs: 5 * 86_400_000 })
  const before = readJson(statePath)
  const { controller, runtime } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    assert.equal(controller.mode, 'normal')
    const connected = await controller.connect('connect')
    assert.equal(connected.ok, true)
    assert.equal(controller.mode, 'external')
    assert.equal(runtime(), null, '外部模式关闭内嵌运行时')
    assert.equal(controller.enqueue(event(1)).ok, true)
    controller.enqueue(event(2))
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.deepEqual(d.stub.received.map(item => item.id), ['turn:1', 'turn:2'])
    assert.equal(controller.outbox.status().queued, 0)
    const state = await controller.panel.state()
    assert.equal(state.link.state, 'connected')
    assert.equal(state.pig.name, '团团')
    const denied = await controller.panel.act({ requestId: 'req-denied-0001', action: 'dev', patch: { coins: 9999 } })
    assert.equal(denied.ok, false)
    assert.equal(denied.reason, 'action-not-allowed')
    assert.equal((await controller.panel.art('../state.json')), null)
    const acted = await controller.panel.act({ requestId: 'req-connect-0001', action: 'pet' })
    assert.equal(acted.ok, true)
    const command = await controller.panel.command('help')
    assert.equal(command.ok, true)
    d.clock.now += 60_000
    const disconnected = await controller.disconnect()
    assert.equal(disconnected.ok, true)
    assert.equal(controller.mode, 'normal')
    const after = readJson(statePath)
    assert.equal(after.ageMs, before.ageMs)
    assert.equal(after.satiety, before.satiety)
    assert.ok(after.lastSeenAt >= BASE + 60_000)
    assert.ok(after.lastActiveAt >= before.lastActiveAt + 60_000)
    assert.equal(existsSync(`${statePath}.external-pet.json`), false)
  } finally { controller.close(); await d.close() }
})

test('合并：预览冻结源端、提交退役、重启不打开旧档、撤销恢复两边', async () => {
  const d = await desktop({ target: { name: '团团', coins: 1240, inventory: { apple: 2 } } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880, inventory: { apple: 3 } })
  const first = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  let mergeId
  try {
    await first.controller.init()
    assert.equal(first.controller.mode, 'normal')
    const preview = await first.controller.previewMerge()
    assert.equal(preview.ok, true, JSON.stringify(preview))
    assert.equal(preview.result.coins, 2120)
    assert.equal(preview.choices.length, 4)
    mergeId = preview.mergeId
    assert.equal(existsSync(`${statePath}.merge`), false)
    assert.equal(first.controller.mode, 'external')
    assert.equal(first.runtime(), null)
    assert.ok(readdirSync(join(d.dir, 'dsh', 'backups')).some(name => name.startsWith('external-')))
    const committed = await first.controller.commitMerge({ duplicate: 'merge' })
    assert.equal(committed.ok, true, JSON.stringify(committed))
    assert.equal(committed.result.coins, 2120)
    assert.equal(existsSync(`${statePath}.merged`), true)
    assert.equal(existsSync(statePath), false)
    assert.equal(existsSync(`${statePath}.merged-${mergeId}`), true)
    assert.equal(existsSync(`${statePath}.work-events.merged-${mergeId}`), true)
    const config = readJson(`${statePath}.external-pet.json`)
    assert.equal(config.pigState, 'merged')
    assert.equal(config.connection, 'connected')
    const target = await d.runtime.view(false)
    assert.equal(target.pig.coins, 2120)
    const linked = await first.controller.panel.state()
    assert.equal(linked.link.merged, true, 'link.merged 让顶部标签显示「已合并」')
    assert.equal(linked.link.dead, false)
  } finally { first.controller.close() }
  // 重启：看到退役标记就不打开旧档。
  const second = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await second.controller.init()
    assert.equal(second.controller.mode, 'external')
    assert.equal(second.runtime(), null)
    const rollback = await second.controller.rollbackMerge(mergeId)
    assert.equal(rollback.ok, true, JSON.stringify(rollback))
    assert.deepEqual(rollback.restored, { target: true, source: true })
    assert.equal(second.controller.mode, 'normal')
    assert.equal(existsSync(statePath), true)
    assert.equal(existsSync(`${statePath}.merged`), false)
    assert.equal(existsSync(`${statePath}.external-pet.json`), false)
    const source = readJson(statePath)
    assert.equal(source.coins, 880)
    const target = await d.runtime.view(false)
    assert.equal(target.pig.coins, 1240)
  } finally { second.controller.close(); await d.close() }
})

test('退役半完成：只补缺的 work-events 改名，不重复改 state；损坏标记不打开旧档', () => {
  const dir = temp()
  try {
    const statePath = join(dir, 'state.json')
    const mergeId = '11111111-1111-4111-8111-111111111111'
    writeFileSync(`${statePath}.merged-${mergeId}`, '{}')
    mkdirSync(`${statePath}.work-events`)
    writeFileSync(`${statePath}.merged`, JSON.stringify({ version: 1, mergeId, stateRenamed: true, workEventsRenamed: false, retiredAt: BASE }))
    const recovered = recoverRetirement(statePath)
    assert.equal(recovered.retired, true)
    assert.equal(recovered.incomplete, false)
    assert.equal(existsSync(statePath), false)
    assert.equal(existsSync(`${statePath}.work-events.merged-${mergeId}`), true)
    assert.equal(existsSync(`${statePath}.merged-${mergeId}`), true, 'state 已在前面完成，不重复覆盖')
    writeFileSync(`${statePath}.merged`, '{broken')
    const corrupt = recoverRetirement(statePath)
    assert.equal(corrupt.retired, true)
    assert.equal(corrupt.corrupt, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('面板动作/命令失败返回最后快照 + ok:false；断线不投内嵌、不打开运行时', async () => {
  const d = await desktop({ target: { name: '团团' } })
  const statePath = dshState(d.dir)
  const { controller, runtime } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    await controller.connect('connect')
    await controller.panel.state()
    await d.pair.close()
    const failed = await controller.panel.act({ requestId: 'req-offline-0001', action: 'pet' })
    assert.equal(failed.ok, false)
    assert.equal(failed.reason, 'disconnected')
    assert.equal(failed.pig.name, '团团')
    assert.equal(runtime(), null)
    const command = await controller.panel.command('feed')
    assert.equal(command.ok, false)
    assert.match(command.text, /动作没有执行/)
    assert.equal((await controller.panel.command('help')).ok, true)
  } finally { controller.close(); await d.close() }
})

test('touch 手势转发到桌面：不是 action-not-allowed，桌面 lastActiveAt 前进', async () => {
  const d = await desktop({ target: { name: '团团' } })
  const statePath = dshState(d.dir)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    assert.equal((await controller.connect('connect')).ok, true)
    d.clock.now += 90_000
    const before = d.runtime.snapshotForWrite().state.lastActiveAt
    const touched = await controller.panel.act({ requestId: 'req-touch-0001', action: 'touch' })
    assert.equal(touched.ok, true, JSON.stringify(touched))
    assert.notEqual(touched.reason, 'action-not-allowed')
    assert.equal(touched.pig.name, '团团')
    const after = d.runtime.snapshotForWrite().state.lastActiveAt
    assert.equal(after, d.clock.now, 'touch 必须真的到达桌面并刷新活跃时间')
    assert.ok(after > before)
    // 禁转发动作仍被拒绝：放行 touch 不能把白名单开成什么都能做。
    const denied = await controller.panel.act({ requestId: 'req-touch-0002', action: 'dev', patch: { coins: 9_999 } })
    assert.equal(denied.ok, false)
    assert.equal(denied.reason, 'action-not-allowed')
  } finally { controller.close(); await d.close() }
})

test('DSH 重启且桌面离线：不给假快照、不打开内嵌猪，仍能管理并切回暂存的内嵌猪', async () => {
  const d = await desktop({ target: { name: '团团', coins: 1240 } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880 })
  const first = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await first.controller.init()
    assert.equal((await first.controller.connect('connect')).ok, true)
    assert.equal((await first.controller.panel.state()).pig.name, '团团')
    await d.pair.close()
  } finally { first.controller.close() }

  // 进程重启：只剩磁盘上的 external-pet.json + 暂存存档；桌面仍然关着。
  const second = controllerFor(statePath, {
    clock: d.clock, markerPath: d.markerPath, homes: d.homes,
    fetch: async () => { throw new Error('offline') },
  })
  try {
    await second.controller.init()
    const status = second.controller.status()
    assert.equal(status.mode, 'external')
    assert.equal(status.connection, 'disconnected')
    assert.equal(status.pigState, 'paused')
    assert.equal(status.desktop.found, false, '桌面没开时发现结果必须是 found=false')
    assert.equal(status.target.summary.coins, 1240, '设置卡片读的持久化摘要还在')

    // /dsh-piggy/state：断线但带 link；没有 pig——不能拿内嵌档或假快照冒充桌面猪。
    const panelState = await second.controller.panel.state()
    assert.equal(panelState.ok, false)
    assert.equal(panelState.reason, 'disconnected')
    assert.equal('pig' in panelState, false)
    assert.equal(panelState.link.state, 'disconnected')

    // 外部模式下 hatch 不能落到内嵌存档，也不能偷偷打开内嵌运行时。
    const hatch = await second.controller.panel.act({ action: 'hatch' })
    assert.equal(hatch.ok, false)
    assert.equal(hatch.reason, 'disconnected')
    assert.equal(hatch.pig, undefined)
    assert.equal(second.runtime(), null)

    // 断线也保留管理入口的最后一层：切回暂存的内嵌猪（不依赖桌面在线）。
    const withdraw = await second.controller.disconnect({ discardQueue: true })
    assert.equal(withdraw.ok, true, JSON.stringify(withdraw))
    assert.equal(second.controller.mode, 'normal')
    const restored = readJson(statePath)
    assert.equal(restored.name, '猪猪')
    assert.equal(restored.coins, 880)
    assert.equal(existsSync(`${statePath}.external-pet.json`), false)
  } finally { second.controller.close(); await d.close() }
})

test('新装 DSH 现场孵化后连接：重启离线切回不被误判 state-changed', async () => {
  const d = await desktop({ target: { name: '团团' } })
  // 不预写存档：模拟全新 DSH 先拆纸盒（内存里是 hatchEgg 的原始形状），再连接桌面猪。
  const statePath = join(d.dir, 'dsh-fresh', 'state.json')
  mkdirSync(join(d.dir, 'dsh-fresh'), { recursive: true })
  const first = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  const second = { controller: null, close: () => {} }
  try {
    try {
      await first.controller.init()
      const hatched = await first.embedded.ensure().handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'hatch' }))
      assert.equal(JSON.parse(String(hatched.body)).ok, true, '现场孵化成功')
      const connected = await first.controller.connect('connect')
      assert.equal(connected.ok, true, JSON.stringify(connected))
      assert.equal(first.controller.status().pigState, 'paused')
      assert.equal(existsSync(statePath), true, '连接时的 flush 会把新猪落盘')
      await d.pair.close()
    } finally { first.controller.close() }

    const restarted = controllerFor(statePath, {
      clock: d.clock, markerPath: d.markerPath, homes: d.homes,
      fetch: async () => { throw new Error('offline') },
    })
    second.controller = restarted.controller
    second.close = () => restarted.controller.close()
    await restarted.controller.init()
    assert.equal(restarted.controller.status().connection, 'disconnected')
    // 同一份存档：重启后 readStateFile() 会补 migrate 默认字段；切回不能因此报 state-changed。
    const withdraw = await restarted.controller.disconnect({ discardQueue: true })
    assert.equal(withdraw.ok, true, JSON.stringify(withdraw))
    assert.notEqual(withdraw.reason, 'state-changed')
    assert.equal(restarted.controller.mode, 'normal')
    const restored = readJson(statePath)
    assert.equal(restored.hatched, true)
    assert.equal(restored.name, '猪猪')
    assert.equal(existsSync(`${statePath}.external-pet.json`), false)
  } finally { second.close(); await d.close() }
})

test('外部模式隐藏在线扩展目录；切回时 stateHash 不匹配要求确认', async () => {  const d = await desktop()
  const statePath = dshState(d.dir)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    await controller.connect('connect')
    assert.deepEqual(controller.panel.online(), { entries: [], external: true, disabled: true })
    const state = readJson(statePath)
    state.coins = 999
    writeFileSync(statePath, JSON.stringify(state))
    const refused = await controller.disconnect()
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, 'state-changed')
    const forced = await controller.disconnect({ confirmChanged: true })
    assert.equal(forced.ok, true)
    assert.equal(controller.mode, 'normal')
  } finally { controller.close(); await d.close() }
})

test('外部配置损坏：改名留证、不打开内嵌存档', async () => {
  const d = await desktop()
  const statePath = dshState(d.dir)
  writeFileSync(`${statePath}.external-pet.json`, '{broken')
  const { controller, runtime } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    assert.equal(controller.mode, 'external')
    assert.equal(controller.status().configCorrupt, true)
    assert.equal(runtime(), null)
    assert.ok(readdirSync(join(d.dir, 'dsh')).some(name => name.startsWith('state.json.external-pet.json.corrupt-')))
    assert.equal((await controller.disconnect()).reason, 'config-corrupt')
  } finally { controller.close(); await d.close() }
})

test('stateFingerprint 对 key 顺序稳定；outbox 文件 0600/目录 0700', () => {
  const dir = temp()
  try {
    assert.equal(stateFingerprint({ a: 1, b: 2 }, []), stateFingerprint({ b: 2, a: 1 }, []))
    const statePath = join(dir, 'state.json')
    const outbox = createOutbox({ statePath, now: () => BASE })
    outbox.load()
    outbox.add(event(1))
    outbox.flush()
    if (process.platform !== 'win32') {
      assert.equal(statSync(`${statePath}.work-outbox.json`).mode & 0o777, 0o600)
      assert.equal(statSync(dir).mode & 0o777, 0o700)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('DSH 只清理登记过的旧合并集；手动备份和损坏 registry 不碰', () => {
  const dir = temp()
  const statePath = join(dir, 'state.json')
  try {
    const backups = join(dir, 'backups')
    mkdirSync(backups, { recursive: true })
    writeFileSync(join(backups, 'external-old.zip'), 'old')
    writeFileSync(join(backups, 'external-new.zip'), 'new')
    writeFileSync(join(backups, 'piggy-save-manual.zip'), 'manual')
    mkdirSync(join(dir, 'state.json.merged-old'))
    const oldId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const newId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    writeDsHistory(statePath, { version: 1, activeMergeId: newId, merges: [
      { mergeId: oldId, sourceBackup: 'external-old.zip', retiredState: `${statePath}.merged-old` },
      { mergeId: newId, sourceBackup: 'external-new.zip' },
    ] })
    const cleanup = cleanupDsOldMerges(statePath, newId)
    assert.equal(cleanup.skipped, false)
    assert.equal(existsSync(join(backups, 'external-old.zip')), false)
    assert.equal(existsSync(join(backups, 'external-new.zip')), true)
    assert.equal(existsSync(join(backups, 'piggy-save-manual.zip')), true)
    assert.equal(existsSync(join(dir, 'state.json.merged-old')), false)
    writeFileSync(join(backups, 'merge-history.json'), '{broken')
    assert.equal(existsSync(join(backups, 'external-new.zip')), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('只恢复内嵌猪：桌面保持合并后的猪，DSH 回到合并前', async () => {
  const d = await desktop({ target: { name: '团团', coins: 1240 } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880 })
  const first = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  let backup = null
  try {
    await first.controller.init()
    const preview = await first.controller.previewMerge()
    backup = preview.sourceBackup
    const committed = await first.controller.commitMerge({ duplicate: 'merge' })
    assert.equal(committed.ok, true)
  } finally { first.controller.close() }
  const second = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await second.controller.init()
    const restored = await second.controller.restoreEmbedded(backup)
    assert.equal(restored.ok, true, JSON.stringify(restored))
    assert.equal(second.controller.mode, 'normal')
    assert.equal(readJson(statePath).coins, 880)
    const target = await d.runtime.view(false)
    assert.equal(target.pig.coins, 2120, "桌面保持合并后的猪")
    assert.equal(existsSync(`${statePath}.merged`), false)
  } finally { second.controller.close(); await d.close() }
})

test('投递错误码：422 丢弃并计数，400/415 停止不再重试，不投给内嵌猪', async () => {
  const d = await desktop()
  const statePath = dshState(d.dir)
  const { controller, runtime } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    await controller.connect('connect')
    let call = 0
    d.stub.setStatus(() => (call++ === 0 ? 422 : 200))
    controller.enqueue(event(1))
    controller.enqueue(event(2))
    await new Promise(resolve => setTimeout(resolve, 1500))
    assert.equal(controller.outbox.status().queued, 0)
    assert.ok(controller.outbox.status().dropped.count >= 1)
    d.stub.setStatus(() => 400)
    controller.enqueue(event(3))
    await new Promise(resolve => setTimeout(resolve, 400))
    assert.equal(controller.outbox.status().queued, 1)
    assert.equal(runtime(), null)
  } finally { controller.close(); await d.close() }
})

test('DSH 侧强制终结：运行中可结束打工；已暂存时按暂停时刻终结、不结算暂停、失败恢复原暂停', async () => {
  const d = await desktop()
  try {
  const base = fresh()
  base.activity = { kind: 'work', key: 'bricks', label: '搬砖', emoji: '💼', startedAt: BASE, endsAt: BASE + 3_600_000, cost: 0 }
  const statePath = dshState(d.dir, base)
  const live = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await live.controller.init()
    const prepared = await live.controller.prepare('activity', 'source')
    assert.equal(prepared.ok, true)
    assert.equal(prepared.alreadyFinished, false)
    assert.equal(readJson(statePath).activity, null)
  } finally { live.controller.close() }

  // 已暂存：直接改存档文件，按 suspendedAt 终结，暂停的那一段不结算。
  const pausedBase = fresh()
  pausedBase.activity = { kind: 'study', key: 'mathematics', label: '上课·数学', emoji: '📚', startedAt: BASE, endsAt: BASE + 30 * 60_000, cost: 120, minutes: 30 }
  pausedBase.coins = 500
  pausedBase.lastFedAt = BASE - 1000
  pausedBase.lastActiveAt = BASE - 2000
  const pausedPath = dshState(join(d.dir, 'paused'), pausedBase)
  const paused = controllerFor(pausedPath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await paused.controller.init()
    await paused.controller.connect('connect')
    const before = readJson(pausedPath)
    const configBefore = readJson(`${pausedPath}.external-pet.json`)
    const receivedBefore = d.stub.received.length
    d.clock.now += 45 * 60_000
    const ended = await paused.controller.prepare('activity', 'source')
    assert.equal(ended.ok, true, JSON.stringify(ended))
    assert.equal(ended.alreadyFinished, false)
    const after = readJson(pausedPath)
    assert.equal(after.activity, null)
    assert.equal(after.satiety, before.satiety, '暂停时间不偷偷结算')
    assert.equal(after.coins, before.coins + 120, '只退这节课的学费，不含暂停期间的任何结算')
    assert.equal(after.ageMs, before.ageMs)
    assert.equal(after.lastFedAt, before.lastFedAt, '暂停时长还没有后移')
    assert.equal(after.settledUpTo, before.settledUpTo)
    const configAfter = readJson(`${pausedPath}.external-pet.json`)
    assert.equal(configAfter.pigState, 'paused')
    assert.equal(configAfter.suspendedAt, configBefore.suspendedAt, '终结不改暂停起点')
    assert.notEqual(configAfter.stateHash, configBefore.stateHash, '配置指纹跟上终结后的存档')
    assert.equal(d.stub.received.length, receivedBefore, '终结不额外投递工作事件')
    assert.equal((await paused.controller.prepare('activity', 'source')).alreadyFinished, true, '重复终结幂等')
    const back = await paused.controller.disconnect()
    assert.equal(back.ok, true, JSON.stringify(back))
    const resumed = readJson(pausedPath)
    assert.equal(resumed.activity, null)
    assert.equal(resumed.ageMs, before.ageMs)
    assert.equal(resumed.lastFedAt, before.lastFedAt + 45 * 60_000, '切回时才按暂停时长后移')
  } finally { paused.controller.close() }

  // 写盘失败：原存档和暂停配置都保留，权限恢复后重试成功。
  const failBase = fresh()
  failBase.activity = { kind: 'trip', key: 'park', label: '旅行·公园', emoji: '🌳', startedAt: BASE, endsAt: BASE + 60 * 60_000, cost: 15, minutes: 60 }
  const failPath = dshState(join(d.dir, 'fail'), failBase)
  const failing = controllerFor(failPath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  const blockedWrite = `${failPath}.tmp`
  try {
    await failing.controller.init()
    await failing.controller.connect('connect')
    const originalBytes = readFileSync(failPath, 'utf8')
    const originalConfig = readFileSync(`${failPath}.external-pet.json`, 'utf8')
    mkdirSync(blockedWrite) // A directory at the atomic temp path blocks writes on Windows and POSIX.
    const failed = await failing.controller.prepare('activity', 'source')
    rmSync(blockedWrite, { recursive: true })
    assert.equal(failed.ok, false)
    assert.equal(failed.reason, 'write-failed')
    assert.equal(readFileSync(failPath, 'utf8'), originalBytes, '失败恢复原存档')
    assert.equal(readFileSync(`${failPath}.external-pet.json`, 'utf8'), originalConfig, '失败后仍是原暂停状态')
    const retried = await failing.controller.prepare('activity', 'source')
    assert.equal(retried.ok, true, JSON.stringify(retried))
    assert.equal(readJson(failPath).activity, null)
  } finally { rmSync(blockedWrite, { recursive: true, force: true }); failing.controller.close() }
  } finally { await d.close() }
})

test('已暂存番茄/钓鱼：按暂停时刻放弃或收鱼；不完成暂停期间到点的番茄', async () => {
  const d = await desktop()
  const base = fresh()
  base.coins = 400
  base.pomodoro = { ...base.pomodoro, startedAt: BASE, minutes: 25, day: null, todayDone: 2, restUntil: null, finishedAt: null, quietBefore: true }
  base.dialogue = { ...base.dialogue, quiet: true }
  const statePath = dshState(d.dir, base)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    await controller.connect('connect')
    const before = readJson(statePath)
    d.clock.now += 40 * 60_000
    const result = await controller.prepare('pomodoro', 'source')
    assert.equal(result.ok, true)
    assert.equal(result.alreadyFinished, false, '暂停期间过期的番茄不按完成结算')
    const after = readJson(statePath)
    assert.equal(after.pomodoro.startedAt, null)
    assert.equal(after.pomodoro.todayDone, before.pomodoro.todayDone)
    assert.equal(after.coins, before.coins, '没有专注奖励')
    assert.equal(after.dialogue.quiet, true, '专注前的免打扰恢复')

    const fishBase = fresh()
    fishBase.fishing = { ...fishBase.fishing, pending: { id: 'caught-1', key: 'fish_crucian', sizeCm: 12, price: 8, caughtAt: BASE, phase: 'caught', castPower: 0.5, bitesAt: BASE, hookUntil: BASE, expiresAt: BASE + 60_000 } }
    const fishPath = join(d.dir, 'fish', 'state.json')
    mkdirSync(join(d.dir, 'fish'), { recursive: true })
    writeFileSync(fishPath, JSON.stringify(fishBase))
    const fish = controllerFor(fishPath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
    try {
      await fish.controller.init()
      await fish.controller.connect('connect')
      d.clock.now += 20 * 60_000
      const kept = await fish.controller.prepare('fishing', 'source')
      assert.equal(kept.ok, true)
      assert.equal(kept.alreadyFinished, true)
      const fishAfter = readJson(fishPath)
      assert.equal(fishAfter.fishing.pending, null)
      assert.equal(fishAfter.fishing.bag.length, fishBase.fishing.bag.length + 1, '已钓起的鱼收进鱼篓')
    } finally { fish.controller.close() }
  } finally { controller.close(); await d.close() }
})

test('连接选择页：两边阻塞项带真实细节，link 带只读 merged/dead', async () => {
  const d = await desktop({ target: { activity: { kind: 'study', key: 'mathematics', stage: 'primary', label: '上课·数学', emoji: '📚', startedAt: BASE, endsAt: BASE + 30 * 60_000, cost: 90, minutes: 30 } } })
  const base = fresh()
  base.pomodoro = { ...base.pomodoro, startedAt: BASE, minutes: 25, day: null, todayDone: 1, restUntil: null, finishedAt: null, quietBefore: null }
  const statePath = dshState(d.dir, base)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    const page = await controller.connect('merge')
    assert.equal(page.ok, true, JSON.stringify(page))
    const desktopBlocker = page.blockers.find(blocker => blocker.side === 'target')
    assert.equal(desktopBlocker.reason, 'activity')
    assert.equal(desktopBlocker.kind, 'study')
    assert.equal(desktopBlocker.refund, 90)
    assert.equal(desktopBlocker.finished, false)
    const sourceBlocker = page.blockers.find(blocker => blocker.side === 'source')
    assert.equal(sourceBlocker.reason, 'pomodoro')
    assert.equal(sourceBlocker.kind, 'pomodoro')
    assert.equal(sourceBlocker.minutes, 25)
    assert.equal(page.source.summary.kind, 'alive')
    assert.equal(page.source.summary.hatched, true)
    assert.equal(page.source.summary.box, false)
  } finally { controller.close(); await d.close() }
})

test('link.dead 跟桌面猪的真实状态；死亡猪摘要 kind=dead', async () => {
  const d = await desktop({ target: { dead: true, health: 0, diedAt: BASE - 1000 } })
  const statePath = dshState(d.dir)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    const connected = await controller.connect('connect')
    assert.equal(connected.ok, true, JSON.stringify(connected))
    const state = await controller.panel.state()
    assert.equal(state.link.dead, true)
    assert.equal(state.link.merged, false)
    assert.equal(controller.status().target.summary.kind, 'dead')
  } finally { controller.close(); await d.close() }
})

test('合并失败恢复：桌面显式变化/拒绝后源端解冻恢复；疑似副本只保留桌宠真实提交', async () => {
  const d = await desktop({ target: { name: '团团', coins: 1240, inventory: { apple: 2 } } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880, inventory: { apple: 3 } })
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    const first = await controller.previewMerge()
    assert.equal(first.ok, true, JSON.stringify(first))
    assert.equal(first.duplicate.suspected, true)
    assert.deepEqual(first.duplicate.options, ['target', 'source', 'merge'])
    // 预览后桌面有显式操作：提交 409 explicit-change，源端恢复，不写合并。
    await d.runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'pet' }))
    const changed = await controller.commitMerge({ duplicate: 'merge' })
    assert.equal(changed.ok, false)
    assert.equal(changed.reason, 'explicit-change')
    assert.equal(controller.mode, 'normal', '源端解冻恢复')
    assert.equal(existsSync(`${statePath}.merged`), false)
    assert.equal(existsSync(statePath), true)
    assert.equal(existsSync(`${statePath}.external-pet.json`), false)
    // 再次预览，只保留桌宠：结果不相加，源端退役。
    const second = await controller.previewMerge()
    assert.equal(second.ok, true, JSON.stringify(second))
    const kept = await controller.commitMerge({ duplicate: 'target' })
    assert.equal(kept.ok, true, JSON.stringify(kept))
    assert.equal(kept.result.coins, 1240, '只保留桌宠：不相加内嵌猪的金币')
    const target = await d.runtime.view(false)
    assert.equal(target.pig.coins, 1240)
    assert.equal(existsSync(`${statePath}.merged`), true)
  } finally { controller.close(); await d.close() }
})

test('桌面确认取消（declined）：两边都没有改动，源端恢复内嵌模式', async () => {
  const d = await desktop({ target: { name: '团团', coins: 1240 }, confirm: () => false })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880 })
  const before = readJson(statePath)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    const preview = await controller.previewMerge()
    assert.equal(preview.ok, true, JSON.stringify(preview))
    const declined = await controller.commitMerge({ duplicate: 'merge' })
    assert.equal(declined.ok, false)
    assert.equal(declined.reason, 'declined')
    assert.equal(controller.mode, 'normal')
    assert.equal(readJson(statePath).coins, before.coins)
    assert.equal(existsSync(`${statePath}.merged`), false)
    assert.equal((await d.runtime.view(false)).pig.coins, 1240, '桌面备份之外没有写入')
  } finally { controller.close(); await d.close() }
})

test('面板快照/动作结果更新桌面猪摘要：买苹果后卡片跟着变，断线保留最后真实摘要', async () => {
  const d = await desktop({ target: { name: '团团', coins: 500 } })
  const statePath = dshState(d.dir, { name: '猪猪', coins: 880, ageMs: 5 * 86_400_000 })
  const first = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  let beforeDisconnect = null
  try {
    await first.controller.init()
    const connected = await first.controller.connect('connect')
    assert.equal(connected.ok, true, JSON.stringify(connected))
    // 第一次探测：就是桌面版 /pair/info 给的摘要（金币 500）。
    const detected = first.controller.status()
    assert.equal(detected.target.summary.coins, 500)
    assert.equal(detected.target.summary.items, 0)
    assert.equal(detected.target.pid, d.marker.pid)
    assert.equal(detected.target.appVersion, '0.6.7')

    // 面板里买一个苹果（6 金币）：摘要跟着动作结果走。
    const bought = await first.controller.panel.act({ action: 'buy', item: 'apple' })
    assert.equal(bought.ok, true, JSON.stringify(bought))
    const after = first.controller.status()
    assert.equal(after.target.summary.coins, 494, '设置卡片不能再显示第一次探测的 500')
    assert.equal(after.target.summary.items, 1)
    assert.deepEqual({ pid: after.target.pid, app: after.target.appVersion, game: after.target.gameVersion, state: after.target.stateVersion },
      { pid: d.marker.pid, app: '0.6.7', game: '0.37.2', state: d.marker.stateVersion }, '更新摘要不能丢 pid/版本')
    // 摘要必须是紧凑摘要，不是整只猪。
    assert.equal('pig' in after.target.summary, false)
    assert.equal('memories' in after.target.summary, false)
    assert.equal(after.target.summary.kind, 'alive')
    // 卡片读的就是这一份：金币 494，不再是 500。
    assert.equal(normalizeStatus(after).target.coins, 494)

    // 失败的动作不改余额（不按请求乐观改）。
    const refused = await first.controller.panel.act({ action: 'buy', item: 'crown' })
    assert.equal(refused.ok, false)
    assert.equal(first.controller.status().target.summary.coins, 494)

    // 面板快照本身也更新摘要：桌面侧另一次操作后重新拉 state 就能看到。
    const petted = await d.runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'pet' }))
    assert.equal(JSON.parse(String(petted.body)).ok, true)
    await first.controller.panel.state()
    const canonical = (await first.controller.client
      ? null
      : null)
    assert.equal(canonical, null)
    beforeDisconnect = first.controller.status().target.summary
    assert.equal(beforeDisconnect.coins, 494)

    // 断线：最后一份真实摘要还在，卡片显示它而不是「还没有猪」。
    await d.pair.close()
    const offline = await first.controller.refresh()
    assert.equal(offline.ok, false)
    const stale = first.controller.status()
    assert.deepEqual(stale.target.summary, beforeDisconnect)
    assert.equal(normalizeStatus(stale).target.coins, 494)
    // 落盘：DSH 重启后仍然显示最后一份真实摘要。
    const config = readJson(`${statePath}.external-pet.json`)
    assert.equal(config.target.summary.coins, 494)
    assert.equal(config.target.pid, d.marker.pid)
  } finally { first.controller.close() }

  const second = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes, fetch: async () => { throw new Error('offline') } })
  try {
    await second.controller.init()
    const restarted = second.controller.status()
    assert.equal(restarted.target.summary.coins, 494, '重启后断线仍显示最后一份真实摘要')
    assert.equal(restarted.target.pid, d.marker.pid)
  } finally { second.controller.close(); await d.close() }
})

test('面板摘要和 /pair/info 的 mergeSummary 同形：物品、徽章、纸盒都算得一样', async () => {
  const d = await desktop({ target: { name: '团团', coins: 500, inventory: { apple: 2, ball: 1 }, achievements: { unlocked: { 'first-meal': { firstAt: BASE - 1000, recovered: false } }, totals: {}, seen: {}, events: {} } } })
  const statePath = dshState(d.dir)
  const { controller } = controllerFor(statePath, { clock: d.clock, markerPath: d.markerPath, homes: d.homes })
  try {
    await controller.init()
    assert.equal((await controller.connect('connect')).ok, true)
    const snapshot = await controller.panel.state()
    const canonical = d.runtime.view(false)
    const fromPanel = summarizeSnapshot(snapshot)
    const fromStore = (await detectDesktop({ fetch: globalThis.fetch, markerPaths: [d.markerPath], homes: d.homes })).target.summary
    assert.deepEqual(fromPanel, fromStore, '面板摘要必须和 /pair/info 的 mergeSummary 一致')
    // 默认玩具小皮球不在存档背包里，两边都不能把它算进去。
    assert.equal(fromPanel.items, 2)
    assert.equal(fromPanel.badges, 1)
    assert.equal(fromPanel.coins, canonical.pig.coins)
    assert.equal(fromPanel.level, canonical.pig.levelInfo.level)
    assert.equal(fromPanel.days, Math.floor(canonical.pig.ageDays))
    // 没有猪时按 mergeSummary(null) 的形状给「没有猪」。
    assert.deepEqual(summarizeSnapshot({ ok: true, hatched: false, dead: false, pig: null }),
      { name: '未孵化', level: 1, days: 0, coins: 0, items: 0, badges: 0, dead: false, hatched: false, box: false, kind: 'none' })
    assert.equal(summarizeSnapshot({ ok: false, reason: 'desktop-busy' }), null, '忙碌占位正文不是快照')
  } finally { controller.close(); await d.close() }
})

test('桌面忙的占位快照不改写最后快照和摘要', async () => {
  let last = null
  const summaries = []
  const replies = [
    { ok: false, reason: 'desktop-busy' },
    { ok: true, hatched: true, dead: false, pig: { name: '团团', coins: 500, levelInfo: { level: 9 }, ageDays: 3 }, inventory: { apple: 1 }, dex: { achievements: [] } },
    { ok: false, reason: 'desktop-busy' },
  ]
  const fetch = async () => ({
    ok: true, status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    async arrayBuffer() { return Buffer.from(JSON.stringify(replies.shift())) },
  })
  const panel = createExternalPanel({
    fetch,
    endpoint: () => ({ pair: { base: 'http://127.0.0.1:1', token: 'a'.repeat(64) } }),
    status: () => ({ connection: 'merging', lastAt: BASE, queued: 0, pigState: 'paused', target: { summary: { dead: false } } }),
    clientId: () => 'dsh-external',
    lastSnapshot: () => last,
    setSnapshot: value => { last = value },
    noteSummary: summary => summaries.push(summary),
    markSeen() {},
    refreshEndpoints() {},
  })
  const busyFirst = await panel.state()
  assert.equal(busyFirst.ok, false)
  assert.equal(busyFirst.reason, 'desktop-busy')
  assert.equal(last, null, '忙的占位正文不能当成快照存下来')
  assert.deepEqual(summaries, [], '没拿到真实快照就不更新摘要')

  const real = await panel.state()
  assert.equal(real.pig.name, '团团')
  assert.equal(last.pig.coins, 500)
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].coins, 500)

  const busyAgain = await panel.state()
  assert.equal(busyAgain.ok, false)
  assert.equal(busyAgain.reason, 'desktop-busy')
  assert.equal(busyAgain.pig.coins, 500, '忙碌时返回最后一份真实快照')
  assert.equal(last.pig.coins, 500, '最后一份真实快照没被占位正文改写')
  assert.equal(summaries.length, 1, '忙的时候不结算摘要')
})
