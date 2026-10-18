// @ts-check
/**
 * 手感与音效的本机设置。
 *
 * 手感：full（默认）/ soft / off。系统 prefers-reduced-motion 时强制 off，
 * 但不改写用户的选择 —— 用户关掉系统偏好后还会回到原来的档位。
 * 音效：{ on, volume }，默认关，音量 0/1/2（轻/中/响）。
 * @module dsh-piggy/client/feel/settings
 */
import { readStore, writeStore } from '../storage.js'

export const FEEL_KEY = 'dsh-piggy:feel'
export const SOUND_KEY = 'dsh-piggy:sound'
export const FEEL_MODES = Object.freeze(['full', 'soft', 'off'])
export const SOUND_VOLUMES = Object.freeze([0, 1, 2])

/** @param {unknown} value */
function cleanMode(value) {
  return typeof value === 'string' && FEEL_MODES.includes(value) ? value : 'full'
}

/** 用户选的手感档位（不受系统减少动态影响）。 */
export function feelMode() {
  return cleanMode(readStore(FEEL_KEY))
}

/** @param {string} mode */
export function setFeelMode(mode) {
  writeStore(FEEL_KEY, cleanMode(mode))
  notifyFeel()
}

/** 系统是否要求减少动态。 */
export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
  } catch {
    return false
  }
}

/** 实际生效的档位：系统减少动态优先于用户档位。 */
export function effectiveFeelMode() {
  return prefersReducedMotion() ? 'off' : feelMode()
}

var feelListeners = new Set()

/** 设置页改档位后立刻通知正在跑的物理层。 @param {(mode: string) => void} fn */
export function onFeelModeChange(fn) {
  feelListeners.add(fn)
  return function () { feelListeners.delete(fn) }
}

function notifyFeel() {
  var mode = effectiveFeelMode()
  feelListeners.forEach(function (fn) {
    try { fn(mode) } catch { /* 一个监听器坏了不影响别的 */ }
  })
}

// 桌面版猪和面板各一个窗口：在面板里改档位，猪窗口要立刻跟上。
// 同一个 origin 的 localStorage 变化会派发 storage 事件（当前窗口不派发，所以不会自己吵自己）。
try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', function (event) {
      if (event !== null && event !== undefined && event.key === FEEL_KEY) notifyFeel()
    })
  }
} catch { /* 没有 storage 事件就等下次交互读一次 */ }

/** 音效设置：默认关，中等音量。 */
export function soundSettings() {
  var raw = null
  try { raw = JSON.parse(readStore(SOUND_KEY) || 'null') } catch { raw = null }
  var on = raw !== null && typeof raw === 'object' && raw.on === true
  var volume = raw !== null && typeof raw === 'object' && Number.isFinite(raw.volume) ? Math.round(raw.volume) : 2
  if (!SOUND_VOLUMES.includes(volume)) volume = 2
  return { on: on, volume: volume }
}

/** @param {{ on?: boolean, volume?: number }} next */
export function setSoundSettings(next) {
  var current = soundSettings()
  var on = next.on === undefined ? current.on : next.on === true
  var volume = next.volume === undefined ? current.volume : Math.round(Number(next.volume))
  if (!SOUND_VOLUMES.includes(volume)) volume = current.volume
  writeStore(SOUND_KEY, JSON.stringify({ on: on, volume: volume }))
  return { on: on, volume: volume }
}
