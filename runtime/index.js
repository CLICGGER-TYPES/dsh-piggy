// @ts-check
/** 游戏本体的运行时：适配器不持有 Store，不直接调用奖励或存档实现。 */
import { createStore } from '../store.js'
import { dispatch } from '../commands.js'
import { registerGameRoutes } from '../routes.js'

/** @param {{statePath:string,fetch?:typeof globalThis.fetch,onSnapshot?:(view:any)=>void,
 * onStateChanged?:()=>void,now?:()=>number,journalHeader?:object}} options */
export function createGameRuntime(options) {
  const store = createStore(options.statePath, { now: options.now })
  if (options.journalHeader) store.journal?.header?.(options.journalHeader)
  const routes = []
  const mounts = new Set()
  let closed = false

  function prepare() {
    if (closed) throw new Error('game runtime closed')
  }

  function mountRoutes(webServer) {
    prepare()
    const dispose = registerGameRoutes({ register(route) {
      return webServer.register({ ...route, async handler(req, res) {
        // 日志导出不访问游戏状态，原宿主允许关闭后读取最后的诊断记录。
        if (!(closed && route.path === '/dsh-piggy/logs/export')) prepare()
        return route.handler(req, res)
      } })
    } }, store, { fetch: options.fetch })
    mounts.add(dispose)
    return () => { mounts.delete(dispose); dispose() }
  }

  mountRoutes({ register: route => { routes.push(route); return () => {} } })

  function handle(method, url, body) {
    prepare()
    const path = url.split('?')[0]
    const route = routes.find(r => r.kind === 'prefix' ? path.startsWith(r.path + '/') : path === r.path)
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
      Promise.resolve(route.handler(req, res)).catch(reject)
    })
  }

  return {
    handle, mountRoutes,
    feed(type) { prepare(); store.feed(type); options.onStateChanged?.() },
    dispatchCommand(command, input) { prepare(); return dispatch(store, command, input) },
    record: (...args) => store.journal?.record?.(...args),
    dispose() {
      if (closed) return
      closed = true
      for (const dispose of mounts) dispose()
      mounts.clear()
      store.dispose()
    },
  }
}
