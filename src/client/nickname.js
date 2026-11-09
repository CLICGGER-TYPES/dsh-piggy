// @ts-check
/** 桌面猪/朋友猪头顶昵称：只存在这台设备，默认显示。 */
import { readStore, writeStore } from './storage.js'

export const NICKNAME_KEY = 'dsh-piggy:show-nicknames'

export function nicknameEnabled() {
  return readStore(NICKNAME_KEY) !== 'off'
}

export function setNicknameEnabled(on) {
  writeStore(NICKNAME_KEY, on ? 'on' : 'off')
}

export function applyNicknamePreference() {
  var root = typeof document !== 'undefined' ? document.documentElement : null
  if (root !== null && root !== undefined && typeof root.setAttribute === 'function') {
    root.setAttribute('data-show-nick', nicknameEnabled() ? 'true' : 'false')
  }
}

/** 本机开关变化时同步一次；settings 在面板窗口，storage 事件能到猪/朋友窗口。 */
export function attachNicknamePreference(onChange) {
  function apply() {
    applyNicknamePreference()
    if (typeof onChange === 'function') onChange()
  }
  apply()
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return function () {}
  function onStorage(event) {
    if (event.key === NICKNAME_KEY) apply()
  }
  window.addEventListener('storage', onStorage)
  return function () { window.removeEventListener('storage', onStorage) }
}
