// @ts-check
/** Owner 路由桥：把已绑定 session 的 store 投影成旧 routes，并拒绝扁平存档/云操作。 */
import { registerGameRoutes } from '../src/host/routes.js'

const OWNER_MODE_REFUSAL_PATHS = [
  '/dsh-piggy/save/export', '/dsh-piggy/save/preview', '/dsh-piggy/save/import',
  '/dsh-piggy/cloud/status', '/dsh-piggy/cloud/branches', '/dsh-piggy/cloud/pull',
  '/dsh-piggy/cloud/push', '/dsh-piggy/cloud/commit', '/dsh-piggy/cloud/history',
]

/**
 * @param {{
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   options:{fetch?:typeof fetch},
 *   selectTargetSession:(binding?:unknown, allowClosing?:boolean)=>any,
 *   onStateChanged?:()=>void,
 * }} deps
 */
export function createOwnerRouteBridge(deps) {
  const { state, options, selectTargetSession, onStateChanged } = deps
  /** @type {WeakMap<object, any[]>} */
  const routeSets = new WeakMap()
  const mountedRoutes = new Set()
  const activeRouteCounts = new Map()
  const activeRouteTasks = new Set()

  function registerOwnerModeRefusalRoutes(webServer) {
    const disposers = []
    for (const path of OWNER_MODE_REFUSAL_PATHS) {
      disposers.push(webServer.register({ kind: 'exact', path, handler: async (_req, res) => {
        res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: 'owner-document mode does not support flat archive or cloud operations' }))
      } }))
    }
    return () => { for (const dispose of disposers) { try { dispose() } catch { /* best effort */ } } }
  }

  /** @param {any} entry */
  function scopedStore(entry) {
    return new Proxy(entry.store, {
      get(target, property) {
        selectTargetSession(entry.session, (activeRouteCounts.get(entry.session) ?? 0) > 0)
        const value = Reflect.get(target, property, target)
        if (typeof value !== 'function') return value
        return (...args) => {
          selectTargetSession(entry.session, (activeRouteCounts.get(entry.session) ?? 0) > 0)
          return Reflect.apply(value, target, args)
        }
      },
    })
  }

  /** @param {any} session @param {Function} handler @param {any} req @param {any} res */
  function runRoute(session, handler, req, res) {
    selectTargetSession(session)
    activeRouteCounts.set(session, (activeRouteCounts.get(session) ?? 0) + 1)
    /** @type {Promise<unknown>} */
    let task
    task = Promise.resolve().then(() => handler(req, res)).finally(() => {
      const count = (activeRouteCounts.get(session) ?? 1) - 1
      if (count <= 0) activeRouteCounts.delete(session)
      else activeRouteCounts.set(session, count)
      activeRouteTasks.delete(task)
    })
    activeRouteTasks.add(task)
    return task
  }

  /** @param {any} session @param {any} entry */
  function routesFor(session, entry) {
    const existing = routeSets.get(session)
    if (existing !== undefined) return existing
    /** @type {{kind:string,path:string,handler:Function}[]} */
    const routes = []
    const routeStore = scopedStore(entry)
    registerGameRoutes({ register(route) { routes.push(route); return () => {} } }, routeStore, {
      fetch: options.fetch,
      // The state route is already pinned to this one session. Attach its data
      // identity to that response; IDs label the presentation but do not select
      // or authorize the target.
      presentationIdentity: { ownerId: state.ownerId, pigId: entry.pigId },
    })
    const webServer = { register(route) { routes.push(route); return () => {} } }
    registerOwnerModeRefusalRoutes(webServer)
    routeSets.set(session, routes)
    return routes
  }

  /** @param {any} webServer @param {any} [binding] */
  function mountRoutes(webServer, binding = state.defaultSession) {
    const entry = selectTargetSession(binding)
    const disposers = []
    for (const route of routesFor(entry.session, entry)) {
      disposers.push(webServer.register({
        ...route,
        handler: (req, res) => runRoute(entry.session, route.handler, req, res),
      }))
    }
    const dispose = () => {
      for (const unmount of disposers) { try { unmount?.() } catch { /* best effort */ } }
      mountedRoutes.delete(dispose)
    }
    mountedRoutes.add(dispose)
    return dispose
  }

  /** @param {string} method @param {unknown} url @param {any} body @param {any} [binding] */
  async function handle(method, url, body, binding = state.defaultSession) {
    const entry = selectTargetSession(binding)
    const path = String(url).split('?')[0]
    const route = routesFor(entry.session, entry).find(candidate => candidate.kind === 'prefix'
      ? path.startsWith(candidate.path + '/') : path === candidate.path)
    if (route === undefined) return { status: 404, headers: {}, body: '' }
    const result = await new Promise((resolveResponse, rejectResponse) => {
      let status = 200
      /** @type {Record<string,string>} */
      let headers = {}
      const req = { method, url, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) } }
      const res = {
        writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) }; return res },
        setHeader(name, value) { headers[name.toLowerCase()] = String(value) },
        end(chunk) { resolveResponse({ status, headers, body: chunk ?? '' }) },
      }
      Promise.resolve(runRoute(entry.session, route.handler, req, res)).catch(rejectResponse)
    })
    if (method === 'POST' && result.status === 200) onStateChanged?.()
    return result
  }

  const drain = () => Promise.allSettled([...activeRouteTasks])
  const unmountAll = () => { for (const unmount of [...mountedRoutes]) unmount() }

  return { mountRoutes, handle, drain, unmountAll }
}
