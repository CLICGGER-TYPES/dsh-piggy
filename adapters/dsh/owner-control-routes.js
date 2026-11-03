// @ts-check
/** Loopback-only control surface for the explicit DSH OwnerDocument adapter. */
import { SESSION_TRANSPORT } from '../../runtime/session-context.js'

const OWNER_PREFIX = '/dsh-piggy/owner'
const PIG_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const BODY_LIMIT = 4096

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(value))
}

function isLoopback(address) {
  if (typeof address !== 'string') return false
  if (address === '::1' || address.startsWith('127.')) return true
  return address.startsWith('::ffff:127.')
}

function sameOrigin(req) {
  const origin = req.headers?.origin
  if (origin === undefined) return true
  try { return typeof req.headers.host === 'string' && new URL(origin).host === req.headers.host }
  catch { return false }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) return null
    chunks.push(chunk)
  }
  if (size === 0) return {}
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(req.headers?.['content-type'] ?? '')) return null
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch { return null }
}

function safeReason(error) {
  const code = error !== null && typeof error === 'object' ? error.code : null
  return typeof code === 'string' && /^[a-z0-9-]{1,80}$/u.test(code) ? code : 'owner-operation-failed'
}

function responseBody(result) {
  try { return JSON.parse(String(result.body)) } catch { return { ok: false, reason: 'owner-runtime-response-invalid' } }
}

/** @param {any} webServer @param {{getRuntime:()=>any,getNetwork:()=>any,getCloud:()=>any,getRestore:()=>any,getSelection:()=>any}} deps */
export function registerDshOwnerControlRoutes(webServer, deps) {
  return webServer.register({ kind: 'prefix', path: OWNER_PREFIX, handler: async (req, res) => {
    if (!isLoopback(req.socket?.remoteAddress) || !sameOrigin(req)) return sendJson(res, 403, { ok: false, reason: 'loopback-only' })
    let url
    try { url = new URL(req.url ?? '', `http://${req.headers?.host ?? '127.0.0.1'}`) }
    catch { return sendJson(res, 400, { ok: false, reason: 'invalid-path' }) }
    if (url.search !== '' || url.hash !== '' || !url.pathname.startsWith(OWNER_PREFIX)) {
      return sendJson(res, 400, { ok: false, reason: 'query-or-path-invalid' })
    }
    const path = url.pathname.slice(OWNER_PREFIX.length) || '/'
    try {
      if (path === '/pigs') {
        if (req.method === 'GET') return sendJson(res, 200, { ok: true, ...deps.getRuntime().listPigTargets() })
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method' })
        const body = await readBody(req)
        if (body === null || Object.keys(body).sort().join(',') !== 'pigId' || typeof body.pigId !== 'string' || !PIG_ID.test(body.pigId)) {
          return sendJson(res, 400, { ok: false, reason: 'pig-id-required' })
        }
        return sendJson(res, 200, { ok: true, ...deps.getRuntime().createPigTarget(body.pigId) })
      }

      const pigMatch = /^\/pigs\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/(state|act|command)$/u.exec(path)
      if (pigMatch !== null) {
        const [, pigId, operation] = pigMatch
        const runtime = deps.getRuntime()
        const session = runtime.openPigSession(pigId, { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'dsh-owner-control' })
        try {
          if (operation === 'state' && req.method === 'GET') {
            const result = await runtime.handle('GET', '/dsh-piggy/state', '', session)
            return sendJson(res, result.status, responseBody(result))
          }
          if (operation === 'act' && req.method === 'POST') {
            const body = await readBody(req)
            if (body === null || Object.keys(body).sort().join(',') !== 'action' || typeof body.action !== 'string') {
              return sendJson(res, 400, { ok: false, reason: 'action-required' })
            }
            const result = await runtime.handle('POST', '/dsh-piggy/act', JSON.stringify(body), session)
            return sendJson(res, result.status, responseBody(result))
          }
          if (operation === 'command' && req.method === 'POST') {
            const body = await readBody(req)
            if (body === null || Object.keys(body).sort().join(',') !== 'input' ||
                typeof body.input !== 'string' || [...body.input].length > 256) {
              return sendJson(res, 400, { ok: false, reason: 'command-input-invalid' })
            }
            const result = runtime.dispatchCommand('pig', body.input, session)
            return sendJson(res, result?.kind === 'error' ? 409 : 200, result)
          }
          return sendJson(res, 405, { ok: false, reason: 'method' })
        } finally { session.dispose() }
      }

      if (path === '/network/status' && req.method === 'GET') return sendJson(res, 200, { ok: true, ...deps.getNetwork().status() })
      if (path === '/network/start' && req.method === 'POST') return sendJson(res, 200, { ok: true, ...(await deps.getNetwork().start()) })
      if (path === '/network/invite' && req.method === 'POST') {
        const body = await readBody(req)
        if (body === null || Object.keys(body).sort().join(',') !== 'pigId' || typeof body.pigId !== 'string') {
          return sendJson(res, 400, { ok: false, reason: 'pig-id-required' })
        }
        return sendJson(res, 200, { ok: true, ...deps.getNetwork().invite(body.pigId) })
      }
      if (path === '/network/stop' && req.method === 'POST') return sendJson(res, 200, { ok: true, ...(await deps.getNetwork().stop()) })

      if (path === '/cloud/status' && req.method === 'GET') return sendJson(res, 200, { ok: true, ...deps.getCloud().status(deps.getRuntime()) })
      if (path === '/cloud/first-sync' && req.method === 'POST') {
        const body = await readBody(req)
        if (body === null || Object.keys(body).sort().join(',') !== 'direction' || typeof body.direction !== 'string') {
          return sendJson(res, 400, { ok: false, reason: 'direction-required' })
        }
        const result = await deps.getCloud().firstSync(deps.getRuntime(), body.direction)
        return sendJson(res, result?.ok === true ? 200 : 409, result)
      }
      if (path === '/cloud/restore' && req.method === 'POST') {
        const body = await readBody(req)
        if (body === null) return sendJson(res, 400, { ok: false, reason: 'restore-selection-invalid' })
        const allowed = Object.keys(body).every(key => ['acceptWarnings', 'pigId', 'token'].includes(key))
        if (!allowed || typeof body.token !== 'string' || body.token === '' || body.token.length > 128 ||
            (body.acceptWarnings !== undefined && typeof body.acceptWarnings !== 'boolean') ||
            (body.pigId !== undefined && (typeof body.pigId !== 'string' || !PIG_ID.test(body.pigId)))) {
          return sendJson(res, 400, { ok: false, reason: 'restore-selection-invalid' })
        }
        const result = await deps.getRestore().import(body.token, {
          acceptWarnings: body.acceptWarnings === true,
          ...(body.pigId === undefined ? {} : { pigId: body.pigId }),
        })
        return sendJson(res, result?.ok === true ? 200 : 409, result)
      }
      if (path === '/cloud/history' && req.method === 'GET') {
        const result = await deps.getCloud().history(deps.getRuntime())
        return sendJson(res, result?.ok === true ? 200 : 409, result)
      }
      if (path === '/selection' && req.method === 'GET') return sendJson(res, 200, { ok: true, ...deps.getSelection() })
      return sendJson(res, 404, { ok: false, reason: 'not-found' })
    } catch (error) {
      const reason = safeReason(error)
      const status = Number.isSafeInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 409
      return sendJson(res, status, { ok: false, reason })
    }
  } })
}
