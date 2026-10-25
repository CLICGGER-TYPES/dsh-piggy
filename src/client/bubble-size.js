// @ts-check
/** Device-local speech size, independent of the pig and its save. */
import { readStore, writeStore } from './storage.js'
import { desktopShell } from './desktop-shell.js'

export const BUBBLE_SIZE_KEY = 'dsh-piggy:bubble-size'

export function bubbleSize() {
  const value = Number(readStore(BUBBLE_SIZE_KEY))
  return Number.isFinite(value) && value > 0 ? value : 1
}

/** Leave room for speech above and below without making an oversized window. */
export function limitBubbleSize(value, area) {
  const width = area?.width > 0 ? area.width : 1280
  const height = area?.height > 0 ? area.height : 800
  const maximum = Math.max(.1, Math.min((width - 24) / 272, (height - 64) / 208))
  return Math.min(maximum, Math.max(.1, Number.isFinite(value) && value > 0 ? value : 1))
}

/**
 * 整屏舞台页没有桌面外壳（window.__dshPiggyShell 恒为 null，见 stage-shell.js）：
 * 它的窗口是所有屏的并集，直接拿 innerWidth/innerHeight 当气泡上限会算出 split 的
 * 几倍。stage-bridge 挂载时登记「猪所在那块屏的工作区」，dispose 时注销。
 * @type {null | (() => {width:number,height:number}|null)}
 */
let stageArea = null

/** 登记/注销舞台页的当前工作区来源（只接受函数或 null）。 */
export function setStageAreaProvider(provider) {
  stageArea = typeof provider === 'function' ? provider : null
}

function stageAreaNow() {
  if (stageArea === null) return null
  try {
    const area = stageArea()
    return area && area.width > 0 && area.height > 0 ? area : null
  } catch { return null }
}

function availableArea() {
  const shell = desktopShell()
  if (shell) return shell.geometry?.()?.workArea ?? {
    width: window.screen?.availWidth, height: window.screen?.availHeight,
  }
  return stageAreaNow() ?? { width: window.innerWidth, height: window.innerHeight }
}

export function applyBubbleSize(host) {
  const scale = limitBubbleSize(bubbleSize(), availableArea())
  // 纯逻辑测试里 host 可能没有 CSSStyleDeclaration；没有就不写，不让测量本身失败。
  if (typeof host?.style?.setProperty !== 'function') return scale
  if (host.style.getPropertyValue('--bubble-scale') !== String(scale)) host.style.setProperty('--bubble-scale', String(scale))
  return scale
}

export function setBubbleSize(value) {
  const scale = limitBubbleSize(value, availableArea())
  writeStore(BUBBLE_SIZE_KEY, String(scale))
  return scale
}

/** Settings and speech are in separate native windows. */
export function attachBubbleSizePreference(host, onChanged) {
  function update() { applyBubbleSize(host); onChanged?.() }
  function onStorage(event) {
    if (event.key === BUBBLE_SIZE_KEY || event.key === null) update()
  }
  applyBubbleSize(host)
  window.addEventListener('storage', onStorage)
  window.addEventListener('resize', update)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('resize', update)
  }
}
