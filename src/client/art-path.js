// @ts-check
/** Built-in PNG paths and stable imported-skin URLs. */
import { PIG_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'
import { PIG_ART_REVISIONS } from '../../packages/pet-core/src/data/art-revisions.js'
import { builtinArtPath } from './art-style.js'
import { ART_URL } from './constants.js'
import { customArtVersion } from './custom-art.js'

export function artSource(key) {
  const path = builtinArtPath(key) ?? (key.startsWith('custom-') ? key : key + '.svg')
  // 自定义图按本机导入版本，内置图按实际内容哈希；修图后立即换URL。
  const version = key.startsWith('custom-') ? customArtVersion(key) : PIG_ART_REVISIONS[key]
  return ART_URL + path + (version ? '?v=' + version : '')
}

export function hasBuiltinArt(key) {
  return Object.hasOwn(PIG_ART_ASSETS, key)
}
