// @ts-check
import { extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readPostBody } from './save-export.js'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' }

/** Serve a file from `root`, refusing anything that climbs out of it. */
async function serveFile(fetchFile, root, rel) {
  const base = resolve(root)
  const file = resolve(base, rel)
  if (!file.startsWith(base + sep)) return new Response('not found', { status: 404 })
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  // 立绘、字体让浏览器缓存：摸猪时立绘在「摸」和「平常」之间来回换，
  // 不缓存的话每次都要重新取一遍，Windows 上会空一帧（猪闪一下）。
  const cache = /^(image|font)\//.test(type) ? { 'cache-control': 'max-age=86400' } : {}
  try {
    // Chromium 的 file loader 支持 ASAR，字体也不必整块读进主进程再复制。
    const response = await fetchFile(pathToFileURL(file).href)
    if (!response.ok) {
      await response.body?.cancel()
      return new Response('not found', { status: 404 })
    }
    return new Response(response.body, { headers: { 'content-type': type, ...cache } })
  } catch { return new Response('not found', { status: 404 }) }
}

/**
 * Renderer requests opt into one pig with `?pig=<pigId>`. The id labels the
 * target; callers still have to map it to an issued worker session token.
 * Pet windows are loaded as `index.html?pig=<id>`; same-origin fetches from
 * that page carry the query in `Referer` even though `/dsh-piggy/*` URLs
 * themselves do not. Both are accepted so an old game package (whose
 * client.js predates the explicit query) still routes to the right pig.
 * @param {{ url: string, referrer?: string, headers?: { get?: (name: string) => string | null } }} request
 * @returns {string|null}
 */
export function pigIdFromRequest(request) {
  const direct = pigIdFromUrl(request?.url)
  if (direct !== null) return direct
  const referer = request?.headers?.get?.('referer')
  const fromHeader = typeof referer === 'string' ? pigIdFromUrl(referer) : null
  if (fromHeader !== null) return fromHeader
  return pigIdFromUrl(request?.referrer)
}

/** @param {unknown} value */
function pigIdFromUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const pigId = new URL(value).searchParams.get('pig')
    return typeof pigId === 'string' && pigId !== '' ? pigId : null
  } catch { return null }
}

/**
 * Build a resolver for `registerGameProtocol({ sessions })`: `?pig=<pigId>`
 * becomes the opaque worker token, while requests without `?pig` keep using
 * the runtime's default session. An unknown pig fails instead of silently
 * acting on the default pig.
 * @param {Map<string, string> | ((pigId: string) => string | null | undefined)} sessions
 * @returns {(request: { url: string, referrer?: string, headers?: { get?: (name: string) => string | null } }) => string|null}
 */
export function createSessionResolver(sessions) {
  return request => {
    const pigId = pigIdFromRequest(request)
    if (pigId === null) return null
    const token = typeof sessions === 'function' ? sessions(pigId) : sessions.get(pigId)
    if (typeof token !== 'string' || token === '') {
      throw Object.assign(new Error(`no desktop session for pig ${pigId}`), { status: 404 })
    }
    return token
  }
}

/**
 * Register the desktop game's existing custom protocol handler.
 * @param {{
 *   protocol: { handle: (scheme: string, handler: (request: Request) => Promise<Response>) => void },
 *   fetchFile: (url: string) => Promise<Response>,
 *   rendererDir: string,
 *   gameDir: string,
 *   getHost: () => { handle: (method: string, url: string, body?: ArrayBuffer, session?: string) => Promise<any> },
 *   isQuitting: () => boolean,
 *   onStateChanged: () => void,
 *   resolveSession?: (request: Request) => string|null|Promise<string|null>,
 *   sessions?: Map<string, string> | ((pigId: string) => string|null|undefined),
 * }} options
 */
export function registerGameProtocol({ protocol, fetchFile, rendererDir, gameDir, getHost, isQuitting, onStateChanged, resolveSession, sessions }) {
  const resolve = resolveSession ?? (sessions === undefined ? () => null : createSessionResolver(sessions))
  protocol.handle('piggy', async request => {
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname)
    if (path.startsWith('/dsh-piggy/')) {
      const body = request.method === 'POST' ? await readPostBody(request) : undefined
      if (isQuitting()) return new Response('game runtime closing', { status: 503 })
      const session = await resolve(request)
      const out = await getHost().handle(request.method, path + url.search, body, session ?? undefined)
      // 存档变了（任一个窗口里做了动作）：告诉两个窗口马上刷新，别等 4 秒一次的轮询，
      // 不然面板里喂完食，猪要过几秒才有反应。
      if (request.method === 'POST') onStateChanged()
      return new Response(out.body, { status: out.status, headers: out.headers })
    }
    if (path === '/client.js') return serveFile(fetchFile, gameDir, 'client.js')
    return serveFile(fetchFile, rendererDir, path === '/' ? 'index.html' : path.slice(1))
  })
}
