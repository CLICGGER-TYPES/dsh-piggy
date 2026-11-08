// @ts-check
/** Local UI preference; it does not become part of the pig save. */
import { ART_URL } from './constants.js'
import { el } from './dom.js'

const BUNDLED = new Set([
  'status', 'card', 'dex', 'skins', 'study', 'work', 'shop', 'travel',
  'bag', 'pomodoro', 'fishing', 'settings', 'update', 'quit', 'dev',
])

/**
 * 主菜单图标一律用 emoji。手绘 SVG 那一版用户 2026-10-06 明确说不要
 * （「变的什么手绘的 svg 是不要的」），所以要的是「Emoji 样式」那行——换整套
 * emoji 字体，不是换图标画法。以前存过 built-in 的设备也回到 emoji。
 */
export function iconStyle() {
  return 'system'
}

/** 少数入口用专门的 PNG（双猪、藏猪方块），失败时回退 emoji。 */
function customIcon(file, iconClass, attr, value, emoji, className) {
  const img = /** @type {HTMLImageElement} */ (el('img', className + ' dp-tile-svg ' + iconClass))
  img.src = ART_URL + file
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  img.setAttribute(attr, value)
  img.addEventListener('error', function () {
    const replacement = el('span', className, emoji)
    img.parentNode?.replaceChild(replacement, img)
  })
  return img
}

/** Missing bundled files fall back to the device's Emoji. */
export function appIcon(key, emoji, className) {
  if (key === 'room') return customIcon('ui-room.png', 'dp-room-icon', 'data-room-icon', 'pair', emoji, className)
  if (key === 'ext:pig-puzzle') return customIcon('ui-pig-puzzle.png', 'dp-pig-puzzle-icon', 'data-pig-puzzle-icon', 'wall', emoji, className)
  if (iconStyle() !== 'built-in' || !BUNDLED.has(key)) return el('span', className, emoji)
  const img = /** @type {HTMLImageElement} */ (el('img', className + ' dp-tile-svg'))
  img.src = ART_URL + 'ui-' + key + '.svg'
  img.alt = emoji
  img.addEventListener('error', function () {
    const replacement = el('span', className, emoji)
    img.parentNode?.replaceChild(replacement, img)
  })
  return img
}
