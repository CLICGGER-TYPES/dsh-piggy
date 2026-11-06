// @ts-check
/**
 * 钓鱼页共用的场景图助手：准备页、等待咬钩和结果页都用同一套钓点图。
 */
import { fishingArtUrl } from '../fishing-art.js'
import { el } from '../dom.js'

/** 概念稿里的水域名和游戏钓点对得上：湖用 pond，海边用 reef。 */
const SCENE_FILE = { river: 'scene-river.png', lake: 'scene-pond.png', sea: 'scene-reef.png', night: 'scene-night.png' }

/** 图片没到位也不留一个破图：底下的 emoji 兜底一直画着，加载成功才盖上去。 */
export function fishImage(name, className) {
  const img = /** @type {HTMLImageElement} */ (el('img', className))
  img.src = fishingArtUrl(name)
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  img.addEventListener('load', function () { img.parentElement?.setAttribute('data-art-loaded', 'true') })
  img.addEventListener('error', function () { img.hidden = true })
  return img
}

export function currentSpot(ui) {
  const fishing = ui.view.fishing
  return fishing.spots?.find(spot => spot.key === fishing.spot) ?? { key: fishing.spot, label: fishing.spot, emoji: '🏞', open: true }
}

export function sceneArt(spot, className) {
  const art = el('div', 'dp-fish-art ' + className)
  art.setAttribute('data-fish-scene', spot.key)
  art.appendChild(el('span', 'dp-fish-art-fallback', spot.emoji))
  art.appendChild(fishImage(SCENE_FILE[spot.key] ?? SCENE_FILE.river, 'dp-fish-art-img'))
  return art
}
