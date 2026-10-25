// @ts-check
/** 舞台静态资源只允许从指定目录读取。 */
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' }

export function serveFile(root, rel) {
  const file = normalize(join(root, rel))
  const base = normalize(root)
  // 前缀必须带分隔符：同级 stage-x/ 目录不能因为 startsWith('…/stage') 被当成舞台文件（A8）。
  if ((file !== base && !file.startsWith(base + sep)) || !existsSync(file)) return new Response('not found', { status: 404 })
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  const cache = /^(image|font)\//.test(type) ? { 'cache-control': 'max-age=86400' } : {}
  return new Response(readFileSync(file), { headers: { 'content-type': type, ...cache } })
}
