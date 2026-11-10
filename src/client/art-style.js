// @ts-check
/**
 * 内置立绘的路径。2026-10-13 起只有一套无描边平涂画（用户：描边不好看，以后不要了），
 * 设置里的「小猪画风」去掉了；以前存的选择不再起作用。
 */
import { PIG_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'

export function builtinArtPath(key) {
  return PIG_ART_ASSETS[key]
}

/** 房间资料只带立绘路径；反查回内置 art key，朋友猪才能走同一套选图。 */
const BUILTIN_KEY_BY_PATH = new Map(Object.entries(PIG_ART_ASSETS).map(([key, path]) => [path, key]))

export function builtinKeyForPath(path) {
  if (typeof path !== 'string' || path === '') return null
  const clean = path.split('?')[0].replace(/^\/dsh-piggy\/art\//, '')
  return BUILTIN_KEY_BY_PATH.get(clean) ?? null
}
