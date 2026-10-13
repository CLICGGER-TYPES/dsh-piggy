// @ts-check
/** Classified PNG artwork and compatibility aliases. */
import { readFileSync } from 'node:fs'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { customSkinArt } from './skin-pack.js'
const ART_ROUTE = '/dsh-piggy/art'
const PIG_ART_PATHS = new Set(Object.values(PIG_ART_ASSETS))

/**
 * Classified PNGs, imported skins and legacy artwork URL aliases.
 */
export function registerArtRoute(webServer, store, sendJson) {
  return webServer.register({
    kind: 'prefix',
    path: ART_ROUTE,
    handler: (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
      const raw = String(req.url ?? '').split('?')[0]
      const name = raw.startsWith(ART_ROUTE + '/') ? raw.slice(ART_ROUTE.length + 1) : ''
      // Only the files this package ships: a fixed, boring name pattern, so
      // nothing from the request can ever walk out of ./assets.
      const flat = /^(?:[a-z][a-z0-9-]{0,63}\.(?:svg|png)|feedback\/[a-z][a-z0-9-]{0,63}\.png)$/.test(name)
      const imported = /^custom-[a-z0-9-]{1,41}$/.test(name)
      if (!PIG_ART_PATHS.has(name) && !flat && !imported) return sendJson(res, 404, { error: 'not found' })
      try {
        const custom = name.startsWith('custom-') ? customSkinArt(store.filePath, name) : null
        const key = name.replace(/\.(?:svg|png)$/, '')
        const path = PIG_ART_ASSETS[key] ?? name
        const art = custom ?? readFileSync(new URL('../assets/' + path, import.meta.url))
        // 自带立绘可以缓存一小时：摸猪、喂食时立绘来回换，每次都重新取会空一帧（猪闪一下）。
        // 自定义皮肤玩家随时会换，仍然每次都问。
        const png = art.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
        res.writeHead(200, { 'content-type': png ? 'image/png' : 'image/svg+xml; charset=utf-8', 'cache-control': custom === null ? 'max-age=3600' : 'no-cache' })
        res.end(art)
      } catch (error) {
        console.warn(`[dsh-piggy] sprite missing: name="${name}" reason="${error instanceof Error ? error.message : String(error)}"`)
        sendJson(res, 404, { error: 'not found' })
      }
    },
  })
}
