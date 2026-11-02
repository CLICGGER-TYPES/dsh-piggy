// @ts-check
/**
 * 扩展对面板的只读视图、静态资源（从 store/ext-runtime.js 拆出来的查看职责）。
 *
 * view() 每次拿自己的数据深拷贝和受限 api，抛错只把这一项标成 {error:true}；
 * 商店/图鉴入口从各扩展的 view 里取 shelf/dex 字段，数量随扩展自己。
 * client.js 和 manifest 登记过的图片按请求从扩展目录读，没登记的一律不给。
 * 加载、动作和合并钩子在 store/ext-load.js；这里不写扩展目录，也不改存档。
 * @module dsh-piggy/store/ext-view
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { extensionOn } from '../core.js'
import { apiFor } from './ext-api.js'
import { ASSET_NAME, ASSET_TYPES, assetNames } from './ext-files.js'

/**
 * @param {{
 *   root: () => string,
 *   loaded: Map<string, {manifest: any, module: any, error: string|null}>,
 *   now: () => number,
 *   keyPattern: RegExp,
 * }} deps
 */
export function createViews(deps) {
  /** 每个开着的下载扩展给它的 App 页的数据。 */
  function views(state) {
    const out = {}
    for (const [key, entry] of deps.loaded) {
      if (state?.extData?.[key] === undefined || !extensionOn(state, key) || typeof entry.module?.view !== 'function') continue
      try { out[key] = entry.module.view(structuredClone(state.extData[key]), apiFor(structuredClone(state), key, { nowMs: deps.now(), currency: entry.manifest?.economy?.currency })) } catch { out[key] = { error: true } }
    }
    return out
  }

  /** 开着的下载扩展给商店和图鉴的入口。 */
  function parts(state, field) {
    return Object.entries(views(state)).flatMap(([extension, view]) => {
      const part = view?.[field]
      return part !== null && typeof part === 'object' && !Array.isArray(part) ? [{ ...part, extension }] : []
    })
  }
  const shelves = state => parts(state, 'shelf')
  const dex = state => parts(state, 'dex')

  /** 扩展的面板脚本（GET /dsh-piggy/ext/<key>/client.js）。 */
  function clientScript(key) {
    if (!deps.keyPattern.test(key) || !deps.loaded.has(key)) return null
    try { return readFileSync(join(deps.root(), key, 'client.js'), 'utf8') } catch { return null }
  }

  /** 扩展的图片（GET /dsh-piggy/ext/<key>/assets/<name>）：只给 manifest 里列了的。 */
  function assetFile(key, name) {
    const entry = deps.loaded.get(key)
    if (!deps.keyPattern.test(key) || entry === undefined || !ASSET_NAME.test(name) || !(assetNames(entry.manifest) ?? []).includes(name)) return null
    try { return { body: readFileSync(join(deps.root(), key, 'assets', name)), type: ASSET_TYPES[name.split('.').pop() ?? ''] } } catch { return null }
  }

  return { views, shelves, dex, clientScript, assetFile }
}
