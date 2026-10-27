// @ts-check
/**
 * DSH 宿主的两组外部桌宠路由。
 *
 * - 面板代理（`registerPanelRoutes`）：`/state`、`/act`、`/art`、`/ext` 这些
 *   和游戏数据打交道的地址，同一个路径内嵌运行时也会注册。两组同时挂上就是
 *   两套 `/state`、`/act`、`/ext`，所以代理只在外部模式挂，内嵌模式下由运行时
 *   自己那一份负责。
 * - 管理路由（`registerManagementRoutes`）：`/external/*` 的连接、重查、合并、
 *   恢复、撤销。设置页永远要能读到它们，所以**两个模式都挂**；以前只在外部
 *   模式注册，正常模式下打开设置就是 `/external/status` + `/recheck` 双 404。
 *
 * 两者都只做转发和校验：存档导入导出、扩展安装删除、皮肤导入、日志都不在这里。
 * 写操作只接受同源 JSON POST（DSH 宿主本身还会校验会话）。
 *
 * @module dsh-piggy/adapters/dsh/external-routes
 */

import { readFileSync } from 'node:fs'

const BODY_LIMIT = 16 * 1024
const STRING = value => (typeof value === 'string' ? value : '')

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    const host = req.headers.host
    return typeof host === 'string' && new URL(origin).host === host
  } catch { return false }
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) return null
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) return null
  try {
    const parsed = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch { return null }
}

function emoji(res) {
  try {
    const font = readFileSync(new URL('../../assets/piggy-emoji.woff2', import.meta.url))
    res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'max-age=3600' })
    res.end(font)
  } catch { sendJson(res, 404, { ok: false, reason: 'not-found' }) }
}

/**
 * 一组路由的注册器：同源校验和错误兜底在这一层，注册出去的每个 handler 都只写业务。
 * @param {any} webServer
 */
function routeRegistry(webServer) {
  const disposers = []
  const register = (kind, path, handler) => {
    disposers.push(webServer.register({
      kind, path,
      handler: async (req, res) => {
        if (!sameOrigin(req)) return sendJson(res, 403, { ok: false, reason: 'forbidden' })
        try { await handler(req, res) } catch (error) {
          if (!res.headersSent) sendJson(res, 500, { ok: false, reason: error?.code ?? 'error' })
        }
      },
    }))
  }
  return { register, dispose: () => { for (const dispose of disposers) { try { dispose() } catch { /* best effort */ } } } }
}

/**
 * 外部模式的面板代理路由：/state、/act、/art、/ext、扩展目录、emoji 字体。
 * 只在外部模式挂；内嵌模式由运行时自己的同路径路由负责，两条不能同时存在。
 * @returns {() => void} disposer
 */
export function registerPanelRoutes(webServer, controller) {
  const registry = routeRegistry(webServer)
  const { register } = registry

  register('exact', '/dsh-piggy/state', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, await controller.panel.state())
  })
  register('exact', '/dsh-piggy/act', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.panel.act(body))
  })
  register('prefix', '/dsh-piggy/art', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    const name = decodeURIComponent(STRING(req.url).split('?')[0].slice('/dsh-piggy/art/'.length))
    const file = await controller.panel.art(name)
    if (file === null) return sendJson(res, 404, { ok: false, reason: 'not-found' })
    res.writeHead(200, { 'content-type': file.type, 'cache-control': name.startsWith('custom-') ? 'no-cache' : 'max-age=3600' })
    res.end(file.body)
  })
  register('prefix', '/dsh-piggy/ext', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    const path = STRING(req.url).split('?')[0].slice('/dsh-piggy/ext/'.length)
    if (!/^[a-z0-9-]{2,24}\/(?:client\.js|assets\/[a-z0-9][a-z0-9-]{0,47}\.(?:webp|png))$/.test(path)) {
      return sendJson(res, 404, { ok: false, reason: 'not-found' })
    }
    const file = await controller.panel.ext(path)
    if (file === null) return sendJson(res, 404, { ok: false, reason: 'not-found' })
    res.writeHead(200, { 'content-type': file.type, 'cache-control': path.endsWith('client.js') ? 'no-store' : 'max-age=86400' })
    res.end(file.body)
  })
  register('exact', '/dsh-piggy/extensions/online', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, controller.panel.online())
  })
  register('exact', '/dsh-piggy/emoji.woff2', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    emoji(res)
  })

  return registry.dispose
}

/**
 * 管理路由：/dsh-piggy/external/*。两个模式都挂，切换、恢复、撤销都不撤。
 * @returns {() => void} disposer
 */
export function registerManagementRoutes(webServer, controller) {
  const registry = routeRegistry(webServer)
  const { register } = registry

  register('exact', '/dsh-piggy/external/status', async (req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, controller.status())
  })
  register('exact', '/dsh-piggy/external/recheck', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    return sendJson(res, 200, { ...(await controller.refresh()), status: controller.status() })
  })
  register('exact', '/dsh-piggy/external/connect', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    const mode = body.mode === 'merge' ? 'merge' : 'connect'
    sendJson(res, 200, await controller.connect(mode))
  })
  register('exact', '/dsh-piggy/external/disconnect', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.disconnect({ discardQueue: body.discardQueue === true, confirmChanged: body.confirmChanged === true }))
  })
  register('exact', '/dsh-piggy/external/merge/prepare', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.prepare(STRING(body.target), body.side === 'source' ? 'source' : 'target'))
  })
  register('exact', '/dsh-piggy/external/merge/preview', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.previewMerge())
  })
  register('exact', '/dsh-piggy/external/merge/commit', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.commitMerge(body.choices ?? {}))
  })
  register('exact', '/dsh-piggy/external/merge/cancel', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, await controller.cancelPreview('user'))
  })
  register('exact', '/dsh-piggy/external/merge/rollback', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.rollbackMerge(STRING(body.mergeId)))
  })
  register('exact', '/dsh-piggy/external/merge/status', async (req, res) => {
    // 客户端轮询用 GET；契约同时保留 POST，两个方法行为一致。
    if (req.method !== 'POST' && req.method !== 'GET') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, await controller.pollMergeStatus())
  })
  register('exact', '/dsh-piggy/external/restore', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    const body = await readJson(req)
    if (body === null) return sendJson(res, 415, { ok: false, reason: 'json-required' })
    sendJson(res, 200, await controller.restoreEmbedded(STRING(body.backup)))
  })
  register('exact', '/dsh-piggy/external/retire/retry', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
    sendJson(res, 200, await controller.retryRetirement())
  })

  return registry.dispose
}

/**
 * 两组一起挂（外部模式一次注册完），返回一个统一的 disposer。
 * 插件按模式分开挂载，用的是上面两个函数；这个组合留给只测一套路由的调用方。
 * @returns {() => void} disposer
 */
export function registerExternalRoutes(webServer, controller) {
  const offPanel = registerPanelRoutes(webServer, controller)
  const offManagement = registerManagementRoutes(webServer, controller)
  return () => { offPanel(); offManagement() }
}
