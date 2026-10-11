// @ts-check
/** A device-local artwork preference, shared by desktop pet and panel windows. */
import { readStore, writeStore } from './storage.js'
import { PIG_ART_ASSETS, NO_OUTLINE_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'
import { ART_URL } from './constants.js'
import { applyFrame, builtinFrame } from './art-framing.js'

export const ART_STYLE_KEY = 'dsh-piggy:art-style'
const CHANGE_EVENT = 'dsh-piggy:art-style-changed'
const PATH_KEYS = new Map()
for (const [key, path] of Object.entries(PIG_ART_ASSETS)) {
  PATH_KEYS.set(path, key)
  PATH_KEYS.set(NO_OUTLINE_ART_ASSETS[key], key)
  PATH_KEYS.set(key + '.png', key)
  PATH_KEYS.set(key + '.svg', key)
}

export function artStyle() {
  return readStore(ART_STYLE_KEY) === 'no-outline' ? 'no-outline' : 'outlined'
}

export function setArtStyle(style) {
  writeStore(ART_STYLE_KEY, style === 'no-outline' ? style : 'outlined')
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function builtinArtPath(key) {
  return (artStyle() === 'no-outline' ? NO_OUTLINE_ART_ASSETS : PIG_ART_ASSETS)[key]
}

/** Also update legacy extension image URLs, such as the blind-box recruit image. */
export function refreshArtImages(host) {
  for (const image of host.querySelectorAll('img')) {
    const src = image.getAttribute('src') || ''
    if (!src.startsWith(ART_URL)) continue
    const key = PATH_KEYS.get(src.slice(ART_URL.length))
    if (!key) continue // Imported skins keep their own artwork.
    const next = ART_URL + builtinArtPath(key)
    if (src !== next) image.setAttribute('src', next)
    if (image.matches('.dp-pig-img,.dp-pig-sleep')) applyFrame(image, builtinFrame(next))
  }
}

export function attachArtPreference(host, onChanged) {
  function refresh() { refreshArtImages(host); onChanged?.() }
  function onStorage(event) {
    if (event.key === ART_STYLE_KEY || event.key === null) refresh()
  }
  // Extensions may insert the old flat URL after a tab has rendered.
  const observer = new MutationObserver(() => refreshArtImages(host))
  observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] })
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, refresh)
  refreshArtImages(host)
  return () => {
    observer.disconnect()
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHANGE_EVENT, refresh)
  }
}
