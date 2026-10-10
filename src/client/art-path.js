// @ts-check
/** Built-in PNG paths and stable imported-skin URLs. */
import { PIG_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'
import { ART_URL } from './constants.js'

export function artSource(key) {
  return ART_URL + (PIG_ART_ASSETS[key] ?? (key.startsWith('custom-') ? key : key + '.svg'))
}

export function hasBuiltinArt(key) {
  return Object.hasOwn(PIG_ART_ASSETS, key)
}
