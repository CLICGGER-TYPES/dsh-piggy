// @ts-check
/** B 协议、真实落盘去重、崩溃恢复和单写者回归。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGameRuntime } from '../runtime/index.js'
import { validateWorkEvent, WORK_EVENT_TYPES, WORK_EVENT_WINDOW_MS } from '../runtime/work-events.js'
import { openWorkLedger } from '../runtime/work-ledger.js'
import { createStore } from '../store.js'
import { hatchEgg, feed, settleAchievements } from '../core.js'
import { startBackgroundHost } from '../apps/desktop/lib/background-host.js'

const NOW = 1_800_000_000_000
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const event = (patch = {}) => ({ version: 1, source: 'test-agent', id: 'turn:1', type: 'turn', at: NOW, ...patch })
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-events-'))

test('v1 只接收五种事件和五个字段，拒绝工作正文及无效身份、时间', () => {
  for (const type of WORK_EVENT_TYPES) assert.doesNotThrow(() => validateWorkEvent(event({ type }), NOW))
  for (const patch of [{ version: 2 }, { source: '' }, { id: '' }, { type: 'prompt' }, { at: NaN }, { prompt: 'secret' }, { code: 'secret' }, { output: 'secret' }, { at: NOW - WORK_EVENT_WINDOW_MS - 1 }, { at: NOW + 300001 }]) {
    assert.throws(() => validateWorkEvent(event(patch), NOW))
  }
  for (const input of [null, [], 'turn', {}]) assert.throws(() => validateWorkEvent(input, NOW))
})

test('来源 + ID 去重落盘；重启重复不再奖励，冲突保留现场', async () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  writeFileSync(statePath, JSON.stringify(hatchEgg(NOW)))
  let runtime = createGameRuntime({ statePath, now: () => NOW })
  try {
    assert.equal(runtime.acceptWorkEvent(event()).status, 'applied')
    const after = read(statePath)
    assert.equal(runtime.acceptWorkEvent(event()).status, 'duplicate')
    assert.deepEqual(read(statePath), after)
    assert.throws(() => runtime.acceptWorkEvent(event({ type: 'tool' })), /id conflict/)
    assert.equal(runtime.acceptWorkEvent(event({ source: 'another-agent' })).status, 'applied')
    runtime.dispose()
    runtime = createGameRuntime({ statePath, now: () => NOW })
    const reopened = read(statePath)
    assert.equal(runtime.acceptWorkEvent(event()).status, 'duplicate')
    assert.deepEqual(read(statePath), reopened)
    const receipts = read(`${statePath}.work-events/receipts.json`).receipts
    assert.equal(receipts.length, 2)
    assert.deepEqual(Object.keys(receipts[0]).sort(), ['at','disposition','id','source','type','version'])
  } finally { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

for (const phase of ['before-state', 'after-state', 'after-receipt']) {
  test(`完整 WAL 在 ${phase} 崩溃后先恢复再打开 Store`, () => {
    const directory = temp(), statePath = join(directory, 'state.json')
    const beforeState = hatchEgg(NOW), nextState = structuredClone(beforeState)
    feed(nextState, 'turn', NOW); settleAchievements(nextState, NOW)
    const receipt = { ...event(), disposition: 'applied' }
    const ledgerDir = `${statePath}.work-events`
    mkdirSync(ledgerDir)
    writeFileSync(statePath, JSON.stringify(phase === 'before-state' ? beforeState : nextState))
    writeFileSync(join(ledgerDir, 'transaction.json'), JSON.stringify({ version: 1, statePath: resolve(statePath), beforeState, nextState, receipt }))
    if (phase === 'after-receipt') writeFileSync(join(ledgerDir, 'receipts.json'), JSON.stringify({ version: 1, receipts: [receipt] }))
    let runtime
    try {
      runtime = createGameRuntime({ statePath, now: () => NOW })
      assert.deepEqual(read(statePath), nextState)
      assert.equal(existsSync(join(ledgerDir, 'transaction.json')), false)
      assert.equal(runtime.acceptWorkEvent(event()).status, 'duplicate')
      assert.equal(read(join(ledgerDir, 'receipts.json')).receipts.length, 1)
    } finally { runtime?.dispose(); rmSync(directory, { recursive: true, force: true }) }
  })
}

test('写收据失败后 WAL 保留，下一次提交先完成事务，不重复奖励', () => {
  const directory = temp(), statePath = join(directory, 'state.json'), ledgerDir = `${statePath}.work-events`
  writeFileSync(statePath, JSON.stringify(hatchEgg(NOW)))
  const ledger = openWorkLedger({ directory: ledgerDir, statePath, now: () => NOW })
  const store = createStore(statePath, { now: () => NOW })
  try {
    mkdirSync(join(ledgerDir, 'receipts.json'))
    assert.throws(() => ledger.receive(store, event()))
    assert.equal(existsSync(join(ledgerDir, 'transaction.json')), true)
    const committed = read(statePath)
    rmSync(join(ledgerDir, 'receipts.json'), { recursive: true })
    assert.equal(ledger.receive(store, event()).status, 'duplicate')
    assert.deepEqual(read(statePath), committed)
    assert.equal(existsSync(join(ledgerDir, 'transaction.json')), false)
  } finally { store.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('同版本存档补默认字段标 dirty，无游戏操作也能保存', () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  const state = hatchEgg(NOW)
  delete state.isOfflineFeedEnabled
  writeFileSync(statePath, JSON.stringify(state))
  const store = createStore(statePath, { now: () => NOW })
  try {
    assert.equal(store.state.isOfflineFeedEnabled, true)
    store.dispose()
    assert.equal(read(statePath).isOfflineFeedEnabled, true)
    assert.equal(read(statePath).version, state.version)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('桌面后台为唯一写者，两路并发提交同一事件只应用一次，关闭后可重新打开', async () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
  let host
  try {
    host = await startBackgroundHost(ROOT, statePath)
    assert.throws(() => createGameRuntime({ statePath }), /live runtime/)
    const work = event({ at: Date.now() })
    const results = await Promise.all([host.acceptWorkEvent(work), host.acceptWorkEvent(work)])
    assert.deepEqual(results.map(result => result.status), ['applied', 'duplicate'])
    assert.equal((await host.handle('GET', '/dsh-piggy/state')).status, 200)
    await host.dispose()
    host = await startBackgroundHost(ROOT, statePath)
    assert.equal((await host.acceptWorkEvent(work)).status, 'duplicate')
  } finally { await host?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('没有小猪时也提交收据，重复不再应用，通知只发一次', () => {
  const directory = temp(), statePath = join(directory, 'state.json')
  let changes = 0
  const runtime = createGameRuntime({ statePath, now: () => NOW, onStateChanged: () => changes++ })
  try {
    assert.deepEqual(runtime.acceptWorkEvent(event()), { ok: true, status: 'applied', disposition: 'ignored' })
    assert.deepEqual(runtime.acceptWorkEvent(event()), { ok: true, status: 'duplicate', disposition: 'ignored' })
    assert.equal(changes, 1)
    assert.equal(existsSync(statePath), false)
  } finally { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
