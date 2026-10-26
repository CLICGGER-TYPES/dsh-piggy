// @ts-check
/**
 * Device-local display scale. It never changes the pig save or its stage.
 *
 * 两个 CSS 变量必须一起写（见 applyPigBox）：`--pig-size` 是猪盒边长，
 * `--pig-scale` 是本机显示比例，装扮 overlay（.dp-slot）只按后者缩放 ——
 * 100% 时各年龄身体仍是 15px/19px，放大小猪时帽子和披风一起变大。
 */
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

/**
 * 写宿主上的两个尺寸变量：猪盒边长（px）+ 本机显示比例（无单位）。
 * 只在这里写，别在页面里各写一半，否则会出现「猪放大了、装扮还是 15px」。
 * @param {any} host
 * @param {number} width
 */
export function applyPigBox(host, width) {
  const style = host?.style
  if (typeof style?.setProperty !== 'function') return
  style.setProperty('--pig-size', width + 'px')
  style.setProperty('--pig-scale', String(pigSize()))
}

/** 按生命阶段的默认体型 + 本机显示比例写上面两个变量。 @param {any} host @param {number} stageSize */
export function syncPigSize(host, stageSize) {
  applyPigBox(host, displayedPigSize(stageSize))
}

/** The desktop settings panel and pet use separate windows and storage events. */
export function attachSizePreference(host, getStage, onChanged) {
  function onStorage(event) {
    if (event.key !== PIG_SIZE_KEY) return
    const stage = getStage()
    if (!stage) return
    syncPigSize(host, stage.size)
    onChanged?.()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
