// @ts-check
/** Device-local display scale. It never changes the pig save or its stage. */
import { readStore, writeStore } from './storage.js'

export const PIG_SIZE_KEY = 'dsh-piggy:pig-size'
const OLD_SCALE = { small: .85, standard: 1, large: 1.3, extra: 1.7, 48: .85, 56: 1, 72: 1.3, 96: 1.7 }

export function pigSize() {
  const saved = readStore(PIG_SIZE_KEY)
  if (saved?.startsWith('scale:')) {
    const value = Number(saved.slice(6))
    if (Number.isFinite(value) && value > 0) return value
  }
  const scale = OLD_SCALE[saved] ?? 1
  if (saved !== null) setPigSize(scale)
  return scale
}

export function setPigSize(value) {
  const scale = Number(value)
  writeStore(PIG_SIZE_KEY, 'scale:' + (Number.isFinite(scale) && scale > 0 ? scale : 1))
}

export function displayedPigSize(stageSize) {
  return stageSize * pigSize()
}

/** The desktop settings panel and pet use separate windows and storage events. */
export function attachSizePreference(host, getStage, onChanged) {
  function onStorage(event) {
    if (event.key !== PIG_SIZE_KEY) return
    const stage = getStage()
    if (!stage) return
    host.style.setProperty('--pig-size', displayedPigSize(stage.size) + 'px')
    onChanged?.()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
