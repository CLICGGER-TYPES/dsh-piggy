// @ts-check
/**
 * Emoji 用哪套：桌面版自带一整套 Noto Color Emoji（apps/desktop/renderer/piggy-emoji.ttf），
 * 网页版提供同家族的 WOFF2 子集；默认用内置，也可以切回系统自带。
 * 用户要求下一次发版统一默认内置，旧设备迁移一次；只存本机，不进养成存档。
 */
import { readStore, writeStore } from './storage.js'
import { applyPatCursor } from './pat-cursor.js'

export const EMOJI_STYLE_KEY = 'dsh-piggy:emoji-style'
export const EMOJI_DEFAULT_MIGRATION_KEY = 'dsh-piggy:emoji-bundled-default-v1'

/** Next-release default, including upgrades that kept the old system choice.
 * Runs once per device; subsequent explicit choices remain the user's own.
 */
function migrateBundledDefault() {
  if (readStore(EMOJI_DEFAULT_MIGRATION_KEY) === '1') return false
  writeStore(EMOJI_STYLE_KEY, 'bundled')
  if (readStore(EMOJI_STYLE_KEY) === 'bundled') writeStore(EMOJI_DEFAULT_MIGRATION_KEY, '1')
  return true
}

export function emojiStyle() {
  if (migrateBundledDefault()) return 'bundled'
  return readStore(EMOJI_STYLE_KEY) === 'system' ? 'system' : 'bundled'
}

export function setEmojiStyle(style) {
  migrateBundledDefault()
  writeStore(EMOJI_STYLE_KEY, style === 'system' ? 'system' : 'bundled')
}

/** 外壳页面里有没有加载内置 emoji 字体（旧外壳没有，就不给这个选项）。 */
export function hasBundledEmoji() {
  try {
    const fonts = /** @type {any} */ (document).fonts
    if (fonts === undefined || typeof fonts.forEach !== 'function') return false
    let found = false
    fonts.forEach(function (face) { if (String(face.family).replace(/["']/g, '') === 'Piggy Emoji') found = true })
    return found
  } catch {
    return false
  }
}

/** 宿主上挂 data-emoji，外壳的 CSS 按它换字体栈。 */
export function applyEmojiStyle(host) {
  host.setAttribute('data-emoji', emojiStyle())
  // 摸猪的光标也是 emoji 画的，跟着这套字体走。
  applyPatCursor(host)
}
