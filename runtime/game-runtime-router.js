// @ts-check
/**
 * 旧版单 target runtime 的 HTTP 路由分发、挂载和进程内 handle。
 *
 * 普通路由走 available()；存档传输和云路由单独排队，关闭时也必须能拒绝新的
 * 请求。日志导出是关闭后唯一还允许读的路由。这个模块不持有 Store，只通过
 * 组合根给的路由数组和 busy/special 集合工作。
 */
/**
 * @param {{
 *   options:any,
 *   state:{closed:boolean,accepting:boolean},
 *   getRoutes:() => any[],
 *   getCloudRoutes:() => Set<any>,
 *   transfer:{routes:any[],clear:() => void},
 *   mounts:Set<() => void>,
 *   active:Set<Promise<unknown>>,
 *   specialActive:Set<Promise<unknown>>,
 *   available:() => void,
 * }} deps
 */
export function createRuntimeRouter(deps) {
  const { options, state, getRoutes, getCloudRoutes, transfer, mounts, active, specialActive, available } = deps

  async function invoke(routeKey, req, res) {
    const route = [...getRoutes(), ...transfer.routes].find(r => r.path === routeKey)
    if (!route) { res.writeHead(404); return res.end('not found') }
    if (transfer.routes.includes(route) || getCloudRoutes().has(route)) {
      if (!state.accepting) {
        res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        return res.end(JSON.stringify({ ok: false, error: 'game runtime closing' }))
      }
      const pending = Promise.resolve().then(() => route.handler(req, res))
      specialActive.add(pending)
      try { return await pending } finally { specialActive.delete(pending) }
    }
    if (!(state.closed && route.path === '/dsh-piggy/logs/export')) {
      try { available() } catch (error) {
        res.writeHead(error.status ?? 503, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ok: false, error: error.message }))
      }
    }
    const pending = Promise.resolve().then(() => route.handler(req, res))
    active.add(pending)
    try { return await pending } finally { active.delete(pending) }
  }

  function mountRoutes(webServer) {
    available()
    const disposers = [...getRoutes(), ...transfer.routes].map(route => webServer.register({ ...route,
      handler: (req, res) => invoke(route.path, req, res) }))
    const dispose = () => { for (const off of disposers) off() }
    mounts.add(dispose)
    return () => { mounts.delete(dispose); dispose() }
  }

  function handle(method, url, body) {
    const path = url.split('?')[0]
    const route = [...getRoutes(), ...transfer.routes].find(r => r.kind === 'prefix' ? path.startsWith(r.path + '/') : path === r.path)
    if (!route) return Promise.resolve({ status: 404, headers: {}, body: '' })
    return new Promise((resolve, reject) => {
      let status = 200
      let headers = {}
      const req = { method, url, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) } }
      const res = {
        writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) }; return res },
        setHeader(name, value) { headers[name.toLowerCase()] = String(value) },
        end(chunk) {
          if (options.onSnapshot && String(headers['content-type'] ?? '').includes('application/json')) {
            const view = JSON.parse(String(chunk))
            if (Array.isArray(view.pending) && view.pending.length > 0) options.onSnapshot(view)
          }
          resolve({ status, headers, body: chunk ?? '' })
        },
      }
      Promise.resolve(invoke(route.path, req, res)).catch(reject)
    })
  }

  return { invoke, mountRoutes, handle }
}
