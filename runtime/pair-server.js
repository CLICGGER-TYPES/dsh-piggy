// @ts-check
/**
 * 本机配对接口：面板镜像、白名单动作/命令、强制终结、合并和只读素材。
 *
 * 独立端口、独立令牌；只监听 127.0.0.1，拒绝 Origin 和 query token。
 * 无窗口的 serve.mjs 不启动它；桌面设置打开「允许 DSH 联动」才启动。
 *
 * @module dsh-piggy/runtime/pair-server
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { join } from 'node:path'

import { mergeSummary } from '../core.js'
import { secureDirectory } from './local-server.js'
import { PAIR_ACTION_SET, PAIR_COMMAND_SET, PAIR_COMMAND_VERBS, PREPARE_TARGETS, commandVerb } from './pair-actions.js'
import { createMergeService } from './merge-service.js'
import { readWorkJson, removeWorkFile, writeWorkJson } from './work-files.js'

const BODY_ACT = 2048
const BODY_COMMIT = 16384
const BODY_PREVIEW = 32 * 1024 * 1024
const DEDUPE_TTL_MS = 10 * 60_000
const DEDUPE_LIMIT = 1024
const CONFIRM_TIMEOUT_MS = 60_000
const CLIENT_ID = /^[a-zA-Z0-9_.:-]{1,80}$/
const REQUEST_ID = /^[a-zA-Z0-9_-]{8,80}$/

function sendJson(response, status, body, extra = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra })
  response.end(JSON.stringify(body))
}

function sendBytes(response, status, body, type, cache = 'no-store') {
  response.writeHead(status, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' })
  response.end(body)
}

function fail(status, reason, message, details = null) {
  return Object.assign(new Error(message ?? reason), { status, code: reason, details })
}

async function readBody(request, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw fail(413, 'body-too-large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(request, limit) {
  const buffer = await readBody(request, limit)
  if (buffer.length === 0) return {}
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) throw fail(415, 'json-required')
  try {
    const parsed = JSON.parse(buffer.toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed
  } catch { throw fail(400, 'invalid-json') }
}

function identities(body) {
  if (!CLIENT_ID.test(String(body.clientId ?? '')) || !REQUEST_ID.test(String(body.requestId ?? ''))) {
    throw fail(400, 'bad-identity', '缺少 clientId/requestId')
  }
  return { clientId: String(body.clientId), requestId: String(body.requestId) }
}

function createDedupe({ now }) {
  const seen = new Map()
  return {
    get(clientId, requestId) {
      const key = `${clientId}\u0000${requestId}`
      const found = seen.get(key)
      if (found === undefined) return null
      if (now() - found.at > DEDUPE_TTL_MS) { seen.delete(key); return null }
      return found.value
    },
    put(clientId, requestId, value) {
      if (seen.size >= DEDUPE_LIMIT) {
        const oldest = [...seen.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, Math.ceil(DEDUPE_LIMIT / 4))
        for (const [key] of oldest) seen.delete(key)
      }
      seen.set(`${clientId}\u0000${requestId}`, { at: now(), value })
    },
    clear() { seen.clear() },
  }
}

function parseArtName(url) {
  const match = /^\/pair\/art\/(.+)$/.exec(url.split('?')[0])
  return match === null ? null : decodeURIComponent(match[1])
}

function parseExt(url) {
  const path = url.split('?')[0]
  const script = /^\/pair\/ext\/([a-z0-9-]{2,24})\/client\.js$/.exec(path)
  if (script !== null) return { key: script[1], path: `/dsh-piggy/ext/${script[1]}/client.js` }
  const asset = /^\/pair\/ext\/([a-z0-9-]{2,24})\/assets\/([a-z0-9][a-z0-9-]{0,47}\.(?:webp|png))$/.exec(path)
  if (asset !== null) return { key: asset[1], path: `/dsh-piggy/ext/${asset[1]}/assets/${asset[2]}`, asset: true }
  return null
}

/**
 * @param {object} options
 * @param {any} options.runtime
 * @param {string} options.directory
 * @param {string} [options.appVersion]
 * @param {string} [options.gameVersion]
 * @param {(plan:any)=>Promise<boolean>|boolean} [options.confirm]
 * @param {() => number} [options.now]
 */
export async function startPairServer(options) {
  await secureDirectory(options.directory)
  const now = options.now ?? (() => Date.now())
  const token = randomBytes(32).toString('hex')
  const discoveryPath = join(options.directory, 'pair.json')
  const dedupe = createDedupe({ now })
  let host = ''
  let closing = false
  const requests = new Set()
  const merge = createMergeService({
    runtime: options.runtime,
    statePath: options.runtime.statePath,
    gameVersion: options.gameVersion ?? '',
    appVersion: options.appVersion ?? '',
    now,
    confirm: async plan => {
      if (typeof options.confirm !== 'function') return false
      let timer
      const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(false), CONFIRM_TIMEOUT_MS); timer.unref?.() })
      try { return (await Promise.race([Promise.resolve(options.confirm(plan)), timeout])) === true }
      finally { clearTimeout(timer) }
    },
  })

  function safeView() {
    try { return options.runtime.view(false) } catch { return null }
  }

  async function act(request, response) {
    const body = await readJson(request, BODY_ACT)
    const { clientId, requestId } = identities(body)
    const action = String(body.action ?? '')
    if (!PAIR_ACTION_SET.has(action)) throw fail(403, 'action-not-allowed', '这个动作不能从配对接口执行')
    const cached = dedupe.get(clientId, requestId)
    if (cached !== null) return sendJson(response, cached.status, cached.body)
    let out
    try {
      out = await options.runtime.handle('POST', '/dsh-piggy/act', JSON.stringify(body))
    } catch (error) {
      const snapshot = safeView()
      const payload = { ...(snapshot ?? { ok: false }), ok: false, reason: error?.code === 'desktop-busy' || error?.status === 503 ? 'desktop-busy' : 'disconnected' }
      return sendJson(response, 200, payload)
    }
    const text = String(out.body ?? '')
    let payload
    try { payload = JSON.parse(text) } catch { payload = { ok: false, reason: 'bad-response' } }
    if (out.status === 503) {
      payload = { ...(safeView() ?? {}), ok: false, reason: 'desktop-busy' }
      return sendJson(response, 200, payload)
    }
    dedupe.put(clientId, requestId, { status: 200, body: payload })
    return sendJson(response, 200, payload)
  }

  async function command(request, response) {
    const body = await readJson(request, BODY_ACT)
    const { clientId, requestId } = identities(body)
    const input = typeof body.input === 'string' ? body.input : ''
    if ([...input].length > 256) throw fail(413, 'command-too-long')
    const verb = commandVerb(input)
    if (!PAIR_COMMAND_SET.has(verb)) throw fail(403, 'command-not-allowed', `/${verb} 不能从配对接口执行`)
    const cached = dedupe.get(clientId, requestId)
    if (cached !== null) return sendJson(response, 200, cached)
    try {
      const result = await options.runtime.dispatchCommand('pig', input)
      const payload = { ok: true, kind: result?.kind ?? 'success', text: String(result?.text ?? '') }
      dedupe.put(clientId, requestId, payload)
      return sendJson(response, 200, payload)
    } catch (error) {
      return sendJson(response, 200, { ok: false, reason: error?.status === 503 ? 'desktop-busy' : 'disconnected' })
    }
  }

  async function prepare(request, response) {
    const body = await readJson(request, BODY_ACT)
    const { clientId, requestId } = identities(body)
    const target = String(body.target ?? '')
    if (!PREPARE_TARGETS.includes(target)) throw fail(400, 'unknown-target')
    const cached = dedupe.get(clientId, requestId)
    if (cached !== null) return sendJson(response, 200, cached)
    const result = await options.runtime.prepareMerge(target)
    const payload = { ok: result.ok !== false, alreadyFinished: result.alreadyFinished === true, summary: result.summary ?? {} }
    if (result.ok === false) payload.reason = result.reason
    dedupe.put(clientId, requestId, payload)
    return sendJson(response, 200, payload)
  }

  async function preview(request, response) {
    if (!/^application\/zip$/i.test(request.headers['content-type'] ?? '')) throw fail(415, 'zip-required')
    const requestId = request.headers['x-request-id']
    if (typeof requestId === 'string' && !REQUEST_ID.test(requestId)) throw fail(400, 'bad-request-id')
    const buffer = await readBody(request, BODY_PREVIEW)
    const report = await merge.preview(buffer, { requestId })
    return sendJson(response, 200, { ok: true, ...report })
  }

  async function commit(request, response) {
    // Native approval may take 60 seconds; ordinary request idle limits must not cut it off.
    request.socket.setTimeout(90_000)
    const body = await readJson(request, BODY_COMMIT)
    const result = await merge.commit({ mergeId: String(body.mergeId ?? ''), previewToken: String(body.previewToken ?? ''), choices: body.choices, sourceBackup: body.sourceBackup, sourceSha256: typeof body.sourceSha256 === 'string' ? body.sourceSha256 : undefined })
    return sendJson(response, 200, result)
  }

  async function status(request, response, url) {
    const mergeId = new URL(url, 'http://127.0.0.1').searchParams.get('mergeId') ?? ''
    if (!/^[a-f0-9-]{36}$/.test(mergeId)) throw fail(400, 'bad-merge-id')
    return sendJson(response, 200, await merge.status(mergeId))
  }

  async function rollback(request, response) {
    const body = await readJson(request, BODY_COMMIT)
    const result = await merge.rollback({ mergeId: String(body.mergeId ?? ''), requestId: String(body.requestId ?? '') })
    return sendJson(response, 200, result)
  }

  async function route(request, response) {
    if (closing) throw fail(503, 'closing')
    const counts = new Map()
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index].toLowerCase()
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    if (counts.has('origin') || counts.get('host') !== 1 || request.headers.host !== host) throw fail(403, 'forbidden')
    const actual = Buffer.from(request.headers.authorization ?? '')
    const expected = Buffer.from(`Bearer ${token}`)
    if (counts.get('authorization') !== 1 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw fail(401, 'unauthorized')
    const url = String(request.url ?? '')
    const path = url.split('?')[0]
    if (request.method === 'GET' && path === '/pair/info') {
      const info = options.runtime.gameInfo()
      return sendJson(response, 200, {
        ok: true, role: 'piggy-pair', version: 1, protocol: 1, pid: process.pid,
        appVersion: options.appVersion ?? '', gameVersion: options.gameVersion ?? '',
        stateVersion: info.stateVersion, mergeRulesVersion: info.mergeRulesVersion,
        hasPig: info.hasPig === true, summary: info.summary,
        capabilities: ['state', 'act', 'command', 'merge', 'art', 'ext'],
        busy: info.busy === true,
        merge: merge.activePreview(),
      })
    }
    if (request.method === 'GET' && path === '/pair/state') return sendJson(response, 200, safeView() ?? { ok: false, reason: 'desktop-busy' })
    if (request.method === 'POST' && path === '/pair/act') return act(request, response)
    if (request.method === 'POST' && path === '/pair/command') return command(request, response)
    if (request.method === 'POST' && path === '/pair/merge/prepare') return prepare(request, response)
    if (request.method === 'POST' && path === '/pair/merge/preview') return preview(request, response)
    if (request.method === 'POST' && path === '/pair/merge/commit') return commit(request, response)
    if (request.method === 'GET' && path === '/pair/merge/status') return status(request, response, url)
    if (request.method === 'POST' && path === '/pair/merge/rollback') return rollback(request, response)
    if (request.method === 'GET' && path.startsWith('/pair/art/')) {
      const name = parseArtName(url)
      if (name === null) throw fail(404, 'not-found')
      const file = options.runtime.art(name)
      if (file === null) throw fail(404, 'not-found')
      return sendBytes(response, 200, file.body, file.type, file.custom ? 'no-cache' : 'max-age=3600')
    }
    if (request.method === 'GET' && path.startsWith('/pair/ext/')) {
      const ext = parseExt(url)
      if (ext === null) throw fail(404, 'not-found')
      const out = await options.runtime.handle('GET', ext.path)
      if (out.status !== 200) throw fail(404, 'not-found')
      return sendBytes(response, 200, out.body, String(out.headers['content-type'] ?? (ext.asset ? 'application/octet-stream' : 'application/javascript')), ext.asset ? 'max-age=86400' : 'no-store')
    }
    throw fail(404, 'not-found')
  }

  const server = createServer({ maxHeaderSize: 16384 }, (request, response) => {
    const task = route(request, response).catch(error => {
      if (response.headersSent || response.destroyed) { request.resume(); return }
      const status = Number.isInteger(error?.status) ? error.status : 500
      sendJson(response, status, { ok: false, reason: error?.code ?? (status === 500 ? 'error' : 'refused'), ...(error?.details ? { details: error.details } : {}) })
      request.resume()
    }).finally(() => requests.delete(task))
    requests.add(task)
  })
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  server.timeout = 30000
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(undefined) })
    })
  } catch (error) { throw error }
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('pair endpoint missing address')
  host = `127.0.0.1:${address.port}`
  try { writeWorkJson(discoveryPath, { version: 1, role: 'piggy-pair', port: address.port, token, pid: process.pid }) }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error }
  let closePromise
  let listenerStopped = false
  return {
    port: address.port,
    close() {
      if (closePromise) return closePromise
      closing = true
      merge.close()
      dedupe.clear()
      closePromise = (async () => {
        if (!listenerStopped) {
          const stopped = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve(undefined)))
          server.closeIdleConnections()
          await stopped
          listenerStopped = true
        }
        await Promise.allSettled([...requests])
        const discovery = readWorkJson(discoveryPath)
        if (discovery === null || discovery.token === token) removeWorkFile(discoveryPath)
      })().catch(error => { closePromise = null; throw error })
      return closePromise
    },
  }
}

export { mergeSummary, PAIR_COMMAND_VERBS }
