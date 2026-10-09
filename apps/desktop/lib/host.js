// @ts-check
/**
 * 桌面版的宿主：直接用插件自己的存档（store.js）和路由（routes.js），
 * 只是把 DSH 的 webServer 换成一张路由表，由 Electron 的自定义协议转进来。
 * 不开任何端口。纯 Node，不依赖 Electron，测试可以直接跑。
 * @module dsh-piggy-desktop/host
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Load the game from `gameDir` and serve its routes.
 * @param {string} gameDir  a folder laid out like apps/desktop/game (see scripts/pack-game.mjs)
 * @param {string} statePath where this pig's save lives
 * @param {{ fetch?: typeof globalThis.fetch, onSnapshot?: (view: any) => void }} [options]
 */
export async function startHost(gameDir, statePath, options = {}) {
  const load = name => import(pathToFileURL(join(gameDir, name)).href)
  const { createStore } = await load('store.js')
  const { registerRoutes } = await load('routes.js')
  const { environmentNote } = await load('environment.js')
  const store = createStore(statePath)
  // 桌面版的日志表头和外壳版本一起记，导出时一眼看出是哪一版外壳。
  store.journal?.header?.(environmentNote({
    运行形态: '桌面版',
    存档路径: statePath,
    Node: process.version,
    ...(typeof process.versions.electron === 'string' ? { Electron: process.versions.electron } : {}),
  }))

  /** @type {{ kind: string, path: string, handler: Function }[]} */
  const routes = []
  const webServer = { register: route => { routes.push(route); return () => {} } }
  registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer }) } }, store, options)

  /**
   * Answer one request the way DSH's web server would.
   * @param {string} method
   * @param {string} url   path only, e.g. /dsh-piggy/state
   * @param {string} [body]
   * @returns {Promise<{ status: number, headers: Record<string, string>, body: any }>}
   */
  function handle(method, url, body) {
    const path = url.split('?')[0]
    const route = routes.find(r => (r.kind === 'prefix' ? path.startsWith(r.path + '/') : path === r.path))
    if (route === undefined) return Promise.resolve({ status: 404, headers: {}, body: '' })
    return new Promise((resolve, reject) => {
      let status = 200
      /** @type {Record<string, string>} */
      let headers = {}
      const req = {
        method, url,
        async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) },
      }
      const res = {
        writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) }; return res },
        setHeader(name, value) { headers[name.toLowerCase()] = String(value) },
        end(chunk) {
          // A snapshot drains the store queue. Fan it out before either window consumes the response.
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

  return { store, handle, dispose: () => store.dispose() }
}
