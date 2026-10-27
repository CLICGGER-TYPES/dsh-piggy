// @ts-check
/** #14 DSH 外部路由：面板代理和管理路由分开挂，各自只注册自己那组；拒绝跨站与错误方法。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { registerExternalRoutes, registerManagementRoutes, registerPanelRoutes } from '../adapters/dsh/external-routes.js'

const controller = {
  status: () => ({ ok: true, mode: 'external', pigState: 'paused', connection: 'connected', queued: 0 }),
  refresh: async () => ({ ok: true }),
  connect: async mode => ({ ok: true, mode }),
  disconnect: async () => ({ ok: true }),
  prepare: async (target, side) => ({ ok: true, target, side }),
  previewMerge: async () => ({ ok: true, mergeId: 'uuid' }),
  commitMerge: async choices => ({ ok: true, choices }),
  cancelPreview: async () => ({ ok: true }),
  rollbackMerge: async mergeId => ({ ok: true, mergeId }),
  pollMergeStatus: async () => ({ ok: true, status: 'committed' }),
  restoreEmbedded: async backup => ({ ok: true, backup }),
  retryRetirement: async () => ({ ok: true }),
  panel: {
    state: async () => ({ ok: true, pig: { name: '团团' } }),
    act: async body => ({ ok: true, action: body.action }),
    art: async () => ({ body: Buffer.from('art'), type: 'image/png' }),
    ext: async () => ({ body: Buffer.from('js'), type: 'application/javascript' }),
    online: () => ({ entries: [], external: true, disabled: true }),
    command: async () => ({ ok: true }),
  },
}

const PANEL = ['/dsh-piggy/state', '/dsh-piggy/act', '/dsh-piggy/art', '/dsh-piggy/ext',
  '/dsh-piggy/extensions/online', '/dsh-piggy/emoji.woff2']
const MANAGEMENT = ['/dsh-piggy/external/status', '/dsh-piggy/external/recheck', '/dsh-piggy/external/connect',
  '/dsh-piggy/external/disconnect', '/dsh-piggy/external/merge/prepare', '/dsh-piggy/external/merge/preview',
  '/dsh-piggy/external/merge/commit', '/dsh-piggy/external/merge/cancel', '/dsh-piggy/external/merge/rollback',
  '/dsh-piggy/external/merge/status', '/dsh-piggy/external/restore', '/dsh-piggy/external/retire/retry']

function setup(register) {
  const routes = []
  const webServer = { register: route => { routes.push(route); return () => { const at = routes.indexOf(route); if (at >= 0) routes.splice(at, 1) } } }
  const dispose = register(webServer, controller)
  const find = (kind, path) => routes.find(route => route.kind === kind && route.path === path)
  const call = async (kind, path, method = 'GET', url = path, body = undefined, headers = {}) => {
    const route = find(kind, path)
    if (route === undefined) return { status: 404, body: '' }
    let status = 0
    let responseBody = ''
    const outHeaders = {}
    const req = { method, url, headers, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body) } }
    const res = {
      headersSent: false,
      writeHead(code, extra) { this.headersSent = true; status = code; Object.assign(outHeaders, extra ?? {}); return res },
      setHeader(name, value) { outHeaders[name] = value },
      end(chunk) { this.headersSent = true; responseBody = chunk === undefined ? '' : String(chunk); return { status, headers: outHeaders, body: responseBody } },
    }
    const result = await route.handler(req, res)
    return result ?? { status, headers: outHeaders, body: responseBody }
  }
  return { routes, dispose, call }
}

const pathsOf = routes => routes.map(route => route.path)

test('面板代理那组只有面板路由，一条管理路由都不带', () => {
  const { routes, dispose } = setup(registerPanelRoutes)
  for (const path of PANEL) assert.ok(pathsOf(routes).includes(path), path)
  for (const path of MANAGEMENT) assert.equal(pathsOf(routes).includes(path), false, `${path} 属于管理路由`)
  for (const path of ['/dsh-piggy/save/import', '/dsh-piggy/save/export', '/dsh-piggy/skins/import', '/dsh-piggy/logs/export']) {
    assert.equal(pathsOf(routes).includes(path), false, path)
  }
  dispose()
  assert.equal(routes.length, 0)
})

test('管理路由那组只有 /external/*，两个模式都能挂', () => {
  const { routes, dispose } = setup(registerManagementRoutes)
  for (const path of MANAGEMENT) assert.ok(pathsOf(routes).includes(path), path)
  for (const path of PANEL) assert.equal(pathsOf(routes).includes(path), false, `${path} 属于面板代理，内嵌模式已经有同路径的路由`)
  for (const path of ['/dsh-piggy/skins/import', '/dsh-piggy/logs/export', '/dsh-piggy/external/install']) {
    assert.equal(pathsOf(routes).includes(path), false, path)
  }
  dispose()
  assert.equal(routes.length, 0)
})

test('两组之间没有同名路由（同时挂上也不会重复占位）', () => {
  const { routes } = setup(registerExternalRoutes)
  const paths = pathsOf(routes)
  assert.equal(new Set(paths).size, paths.length, `重复注册：${paths.filter((path, index) => paths.indexOf(path) !== index).join('、')}`)
  assert.equal(paths.length, PANEL.length + MANAGEMENT.length)
})

test('同源校验、方法校验、请求体类型和 JSON 上限', async () => {
  const { call } = setup(registerExternalRoutes)
  assert.equal((await call('exact', '/dsh-piggy/external/status')).status, 200)
  assert.equal((await call('exact', '/dsh-piggy/external/status', 'GET', '/dsh-piggy/external/status', undefined, { origin: 'https://evil.example', host: '127.0.0.1' })).status, 403)
  assert.equal((await call('exact', '/dsh-piggy/external/connect', 'GET')).status, 405)
  assert.equal((await call('exact', '/dsh-piggy/external/connect', 'POST', '/dsh-piggy/external/connect', 'mode=merge', { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await call('exact', '/dsh-piggy/external/connect', 'POST', '/dsh-piggy/external/connect', 'x'.repeat(17000), { 'content-type': 'application/json' })).status, 415)
  const connected = await call('exact', '/dsh-piggy/external/connect', 'POST', '/dsh-piggy/external/connect', JSON.stringify({ mode: 'merge' }), { 'content-type': 'application/json' })
  assert.equal(connected.status, 200)
  assert.equal(JSON.parse(connected.body).mode, 'merge')
})

test('art/ext 白名单在 DSH 侧就拒绝穿越和任意路径', async () => {
  const { call } = setup(registerPanelRoutes)
  assert.equal((await call('prefix', '/dsh-piggy/ext', 'GET', '/dsh-piggy/ext/../../state.json')).status, 404)
  assert.equal((await call('prefix', '/dsh-piggy/ext', 'GET', '/dsh-piggy/ext/garden/../../state.json')).status, 404)
  assert.equal((await call('prefix', '/dsh-piggy/ext', 'GET', '/dsh-piggy/ext/garden/client.js')).status, 200)
})

test('merge/status 同时接受 GET 和 POST（客户端轮询用 GET），其他方法 405', async () => {
  const { call } = setup(registerManagementRoutes)
  const get = await call('exact', '/dsh-piggy/external/merge/status', 'GET', '/dsh-piggy/external/merge/status')
  assert.equal(get.status, 200)
  assert.equal(JSON.parse(get.body).status, 'committed')
  const post = await call('exact', '/dsh-piggy/external/merge/status', 'POST', '/dsh-piggy/external/merge/status', '{}', { 'content-type': 'application/json' })
  assert.equal(post.status, 200)
  assert.equal((await call('exact', '/dsh-piggy/external/merge/status', 'PUT')).status, 405)
})
