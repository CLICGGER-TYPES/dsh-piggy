// @ts-check
/** Built-in PNG paths and stable imported-skin URLs. */
import { PIG_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'
import { builtinArtPath } from './art-style.js'
import { ART_URL } from './constants.js'
import { customArtVersion } from './custom-art.js'

export function artSource(key) {
  const path = builtinArtPath(key) ?? (key.startsWith('custom-') ? key : key + '.svg')
  // 同一个 key 重新导入后，自定义立绘靠本机版本号换成新地址；内置图/反馈图不变。
  const version = key.startsWith('custom-') ? customArtVersion(key) : 0
  return ART_URL + path + (version > 0 ? '?v=' + version : '')
}

export function hasBuiltinArt(key) {
  return Object.hasOwn(PIG_ART_ASSETS, key)
}
