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
 * Register the desktop game's existing custom protocol handler.
 * @param {{
 *   protocol: { handle: (scheme: string, handler: (request: Request) => Promise<Response>) => void },
 *   fetchFile: (url: string) => Promise<Response>,
 *   rendererDir: string,
 *   gameDir: string,
 *   getHost: () => { handle: (method: string, url: string, body?: ArrayBuffer) => Promise<any> },
 *   isQuitting: () => boolean,
 *   onStateChanged: () => void,
 * }} options
 */
export function registerGameProtocol({ protocol, fetchFile, rendererDir, gameDir, getHost, isQuitting, onStateChanged }) {
  protocol.handle('piggy', async request => {
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname)
    if (path.startsWith('/dsh-piggy/')) {
      const body = request.method === 'POST' ? await readPostBody(request) : undefined
      if (isQuitting()) return new Response('game runtime closing', { status: 503 })
      const out = await getHost().handle(request.method, path + url.search, body)
      // 存档变了（任一个窗口里做了动作）：告诉两个窗口马上刷新，别等 4 秒一次的轮询，
      // 不然面板里喂完食，猪要过几秒才有反应。
      if (request.method === 'POST') onStateChanged()
      return new Response(out.body, { status: out.status, headers: out.headers })
    }
    if (path === '/client.js') return serveFile(fetchFile, gameDir, 'client.js')
    return serveFile(fetchFile, rendererDir, path === '/' ? 'index.html' : path.slice(1))
  })
}
