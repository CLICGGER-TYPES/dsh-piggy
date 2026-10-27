// @ts-check
/**
 * Issue14 真 DSH 整合：路由注册与模式生命周期。
 *
 * 这里不走 controller，而是像宿主那样调插件自己的 `apply`、`inject`、`effect`，
 * 看它到底往 webServer 注册了什么。修前的问题：管理路由（`/dsh-piggy/external/*`）
 * 只在外部模式注册，正常模式下打开设置 → `/external/status`、`/external/recheck` 双 404。
 * 修法要求：管理路由两个模式都在，面板代理只在外部模式，切换时不能重复占位，
 * 关闭时全部撤掉。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { apply } from '../adapters/dsh/index.js'
import { hatchEgg, migrate } from '../core.js'
import { readStateFile } from '../store/state-file.js'
import { createSourceBackup } from '../adapters/dsh/external-merge.js'
import { configPath, stateFingerprint, writeConfig } from '../adapters/dsh/external-files.js'

const NOW = 1_800_000_000_000
const MANAGEMENT = [
  '/dsh-piggy/external/status',
  '/dsh-piggy/external/recheck',
  '/dsh-piggy/external/connect',
  '/dsh-piggy/external/disconnect',
  '/dsh-piggy/external/merge/prepare',
  '/dsh-piggy/external/merge/preview',
  '/dsh-piggy/external/merge/commit',
  '/dsh-piggy/external/merge/cancel',
  '/dsh-piggy/external/merge/rollback',
  '/dsh-piggy/external/merge/status',
  '/dsh-piggy/external/restore',
  '/dsh-piggy/external/retire/retry',
]
const PROXIED = ['/dsh-piggy/state', '/dsh-piggy/act', '/dsh-piggy/art', '/dsh-piggy/ext', '/dsh-piggy/extensions/online', '/dsh-piggy/emoji.woff2']
/** 内嵌运行时独有的路由：外部模式下面板请求走配对接口，这些必须让位。 */
const EMBEDDED_ONLY = ['/dsh-piggy/skins/import', '/dsh-piggy/logs/export', '/dsh-piggy/logs/client']

const freshState = nowMs => migrate(hatchEgg(nowMs), nowMs)

/**
 * 一个够用的 DSH 宿主：`inject` 只交出去真正要求的两项服务，`effect` 收集清理。
 * webServer 的注册表用数组保存，重复注册同一个 path 会真的留下两条（测试要能看见）。
 */
function boot(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-dsh-registration-'))
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(freshState(NOW)))

  if (options.paused === true) pauseSource(statePath)
  if (options.merged === true) {
    writeConfig(statePath, { pigState: 'merged', connection: 'connected', clientId: 'test-client', target: null, suspendedAt: NOW, stateHash: null, mergeId: 'merge-0001', lastSummary: null })
  }

  const routes = []
  const webServer = {
    register(route) {
      routes.push(route)
      return () => { const at = routes.indexOf(route); if (at >= 0) routes.splice(at, 1) }
    },
  }
  const disposers = []
  let pendingWebServer = null
  const ctx = {
    on() {},
    effect(fn) { const dispose = fn(); disposers.push(dispose); return () => dispose?.() },
    inject(deps, fn) {
      if (deps.includes('webServer')) {
        if (options.webServer === 'never') return
        pendingWebServer = () => fn({ webServer })
        if (options.webServer !== 'later') pendingWebServer()
        return
      }
      if (deps.includes('commands')) fn({ commands: { register() {} } })
    },
  }
  const env = { DSH_HOME: dir }
  const saved = { DSH_HOME: process.env.DSH_HOME }
  process.env.DSH_HOME = env.DSH_HOME
  try { apply(ctx, { statePath }) } finally { restore('DSH_HOME', saved.DSH_HOME) }

  const releaseWebServer = () => { if (pendingWebServer === null) return false; const fn = pendingWebServer; pendingWebServer = null; fn(); return true }
  const cleanup = () => {
    for (const dispose of disposers) dispose?.()
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
  return { dir, statePath, routes, releaseWebServer, cleanup }
}

function restore(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

/** 把内嵌猪按外部模式「暂存」的现场：配置写 paused + 状态指纹，disconnect 才能恢复。 */
function pauseSource(statePath) {
  const state = readStateFile(statePath, NOW).state
  writeConfig(statePath, {
    pigState: 'paused', connection: 'connected', clientId: 'test-client', target: null,
    suspendedAt: NOW, stateHash: stateFingerprint(state, []), mergeId: null, lastSummary: null,
  })
}

const settle = () => new Promise(resolve => setTimeout(resolve, 25))

function find(routes, kind, path) {
  return routes.filter(route => route.kind === kind && route.path === path)
}

function assertUnique(routes) {
  const counts = new Map()
  for (const route of routes) {
    const key = `${route.kind} ${route.path}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const [key, count] of counts) assert.equal(count, 1, `同一个路由被注册了 ${count} 次：${key}`)
}

function assertHas(routes, paths, label) {
  for (const path of paths) {
    assert.equal(find(routes, 'exact', path).length + find(routes, 'prefix', path).length, 1, `${label}缺少路由 ${path}`)
  }
}

function assertMissing(routes, paths, label) {
  for (const path of paths) {
    assert.equal(find(routes, 'exact', path).length + find(routes, 'prefix', path).length, 0, `${label}不该有路由 ${path}`)
  }
}

async function call(routes, path, method = 'GET', body = undefined) {
  const route = find(routes, 'exact', path)[0] ?? find(routes, 'prefix', path)[0]
  if (route === undefined) return { status: 404, json: null }
  const req = {
    method, url: path, headers: body === undefined ? {} : { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) },
  }
  let status = 0
  let text = ''
  const res = {
    headersSent: false,
    writeHead(code) { this.headersSent = true; status = code; return res },
    setHeader() {},
    end(chunk) { this.headersSent = true; if (chunk !== undefined) text = String(chunk); return res },
  }
  await route.handler(req, res)
  let json = null
  try { json = text === '' ? null : JSON.parse(text) } catch { json = null }
  return { status, json }
}

test('正常模式：管理路由和面板路由都在，代理没有第二份', async () => {
  const app = boot()
  try {
    await settle()
    assertUnique(app.routes)
    assertHas(app.routes, MANAGEMENT, '正常模式')
    // 设置页要读的两条：修前这里都是 404。
    const status = await call(app.routes, '/dsh-piggy/external/status')
    assert.equal(status.status, 200)
    assert.equal(status.json.mode, 'embedded')
    assert.equal(status.json.can.connect, true)
    const recheck = await call(app.routes, '/dsh-piggy/external/recheck', 'POST', {})
    assert.equal(recheck.status, 200)
    assert.equal(recheck.json.status.mode, 'embedded')
    // 面板请求由运行时自己的那份负责：返回真正的快照（带 package version）。
    const state = await call(app.routes, '/dsh-piggy/state')
    assert.equal(state.status, 200)
    assert.equal(typeof state.json.version, 'string', '正常模式的面板路由必须是内嵌快照，不是外部代理')
    assertHas(app.routes, EMBEDDED_ONLY, '正常模式')
  } finally { app.cleanup() }
})

test('webServer 晚到时两个模式的路由都补得上，且只挂一次', async () => {
  const embedded = boot({ webServer: 'later' })
  const external = boot({ paused: true, webServer: 'later' })
  const never = boot({ webServer: 'never' })
  try {
    await settle()
    assert.deepEqual(embedded.routes, [], '还没拿到 webServer 时不该注册任何东西')
    assert.deepEqual(external.routes, [])
    assert.equal(embedded.releaseWebServer(), true)
    assert.equal(external.releaseWebServer(), true)
    assertUnique(embedded.routes)
    assertUnique(external.routes)
    assertHas(embedded.routes, MANAGEMENT, '晚到的 webServer（内嵌）')
    assertHas(embedded.routes, ['/dsh-piggy/state'], '晚到的 webServer（内嵌）')
    assertHas(external.routes, MANAGEMENT, '晚到的 webServer（外部）')
    assertHas(external.routes, ['/dsh-piggy/state'], '晚到的 webServer（外部）')
    assertMissing(external.routes, EMBEDDED_ONLY, '外部模式')
    assert.equal(never.releaseWebServer(), false, '没有 webServer 的宿主什么都没排队')
    assert.deepEqual(never.routes, [])
  } finally { embedded.cleanup(); external.cleanup(); never.cleanup() }
})

test('外部模式（暂存配置）：代理接管面板，管理路由仍在，内嵌专用路由让位', async () => {
  const app = boot({ paused: true })
  try {
    await settle()
    assertUnique(app.routes)
    assertHas(app.routes, MANAGEMENT, '外部模式')
    const status = await call(app.routes, '/dsh-piggy/external/status')
    assert.equal(status.status, 200)
    assert.equal(status.json.mode, 'external')
    // /state 只有一份，而且是代理的那份（桌面版没连上 → 失败形状，不是内嵌快照）。
    const state = await call(app.routes, '/dsh-piggy/state')
    assert.equal(state.status, 200)
    assert.equal(state.json.ok, false)
    assert.equal(state.json.reason, 'disconnected')
    assert.equal(state.json.version, undefined, '外部模式不能还挂着内嵌的 /state')
    assertMissing(app.routes, EMBEDDED_ONLY, '外部模式')
    assertHas(app.routes, ['/dsh-piggy/ext', '/dsh-piggy/art', '/dsh-piggy/extensions/online'], '外部模式')
    const merge = await call(app.routes, '/dsh-piggy/external/merge/status')
    assert.equal(merge.status, 200)
  } finally { app.cleanup() }
})

test('切回内嵌（disconnect）：管理路由一次不丢，代理让位给内嵌路由', async () => {
  const app = boot({ paused: true })
  try {
    await settle()
    const before = app.routes.map(route => route.path)
    const disconnected = await call(app.routes, '/dsh-piggy/external/disconnect', 'POST', {})
    assert.equal(disconnected.status, 200, JSON.stringify(disconnected.json))
    assert.equal(disconnected.json.ok, true)
    assert.equal(disconnected.json.mode, 'embedded')
    assertUnique(app.routes)
    assertHas(app.routes, MANAGEMENT, '切回内嵌后')
    for (const path of before) assert.ok(app.routes.some(route => route.path === path), `切换掉了管理路由 ${path}`)
    // 管理路由还在，而且现在报的是内嵌模式。
    const status = await call(app.routes, '/dsh-piggy/external/status')
    assert.equal(status.status, 200)
    assert.equal(status.json.mode, 'embedded')
    assert.equal((await call(app.routes, '/dsh-piggy/external/recheck', 'POST', {})).status, 200)
    // 面板路由换回内嵌，且只有一份。
    assert.equal(find(app.routes, 'exact', '/dsh-piggy/state').length, 1)
    const state = await call(app.routes, '/dsh-piggy/state')
    assert.equal(typeof state.json.version, 'string', '切回内嵌后 /state 必须是内嵌快照')
    assertHas(app.routes, EMBEDDED_ONLY, '切回内嵌后')
  } finally { app.cleanup() }
})

test('恢复内嵌备份：管理路由一次不丢，面板回到内嵌', async () => {
  const app = boot({ merged: true })
  try {
    await settle()
    assertHas(app.routes, MANAGEMENT, '已退役（外部）')
    const backup = createSourceBackup({ statePath: app.statePath, state: freshState(NOW), gameVersion: '0.37.2', nowMs: NOW, mergeId: 'merge-0001' })
    const restored = await call(app.routes, '/dsh-piggy/external/restore', 'POST', { backup: backup.name })
    assert.equal(restored.status, 200, JSON.stringify(restored.json))
    assert.equal(restored.json.ok, true)
    assertUnique(app.routes)
    assertHas(app.routes, MANAGEMENT, '恢复内嵌后')
    const status = await call(app.routes, '/dsh-piggy/external/status')
    assert.equal(status.status, 200)
    assert.equal(status.json.mode, 'embedded')
    const state = await call(app.routes, '/dsh-piggy/state')
    assert.equal(typeof state.json.version, 'string', '恢复后 /state 必须是内嵌快照')
    assertHas(app.routes, EMBEDDED_ONLY, '恢复内嵌后')
  } finally { app.cleanup() }
})

test('关闭时把三组路由全部撤掉，不留半套', async () => {
  const app = boot({ paused: true })
  await settle()
  try { assert.ok(app.routes.length > 0) } finally { app.cleanup() }
  assert.deepEqual(app.routes, [], '关闭后 webServer 上不该留任何 piggy 路由')
})
