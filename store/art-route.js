// @ts-check
/** Classified PNG artwork and compatibility aliases. */
import { readFileSync } from 'node:fs'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { customSkinArt } from './skin-pack.js'
const ART_ROUTE = '/dsh-piggy/art'
const PIG_ART_PATHS = new Set(Object.values(PIG_ART_ASSETS))
// 场景插画与小猪立绘分开登记；只开放实际随包分发的文件，不扩大任意路径读取范围。
const FISHING_ART_PATHS = new Set(['scene-river', 'scene-pond', 'scene-reef', 'scene-night', 'fight-tug', 'crucian-result', 'bobber'].map(name => `fishing/${name}.png`))

/** 按名字读一张面板素材；只认随包分发的立绘/反馈图、导入皮肤和动作帧。 */
export function artFile(store, name) {
  const flat = /^(?:[a-z][a-z0-9-]{0,63}\.(?:svg|png)|feedback\/[a-z][a-z0-9-]{0,63}\.png)$/.test(name)
  const imported = /^custom-[a-z0-9-]{1,41}$/.test(name)
  const petFrame = name === 'animations/piglet-pet/reference.webp' || name === 'animations/pet-hand/hand.webp'
  if (!PIG_ART_PATHS.has(name) && !FISHING_ART_PATHS.has(name) && !flat && !imported && !petFrame) return null
  try {
    const custom = name.startsWith('custom-') ? customSkinArt(store.filePath, name) : null
    const key = name.replace(/\.(?:svg|png)$/, '')
    const path = PIG_ART_ASSETS[key] ?? name
    const body = custom ?? readFileSync(new URL('../assets/' + path, import.meta.url))
    const png = body.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    return {
      body,
      type: petFrame ? 'image/webp' : png ? 'image/png' : 'image/svg+xml; charset=utf-8',
      custom: custom !== null,
    }
  } catch { return null }
}

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
      const file = artFile(store, name)
      if (file === null) return sendJson(res, 404, { error: 'not found' })
      // 自带立绘可以缓存一小时：摸猪、喂食时立绘来回换，每次都重新取会空一帧（猪闪一下）。
      // 自定义皮肤玩家随时会换，仍然每次都问。
      res.writeHead(200, { 'content-type': file.type, 'cache-control': file.custom ? 'no-cache' : 'max-age=3600' })
      res.end(file.body)
    },
  })
}
