// @ts-check
/**
 * 摸到了哪儿（G 批次）：按点在猪身上的相对位置分成头、耳朵、鼻子、肚子、背、尾巴、脚。
 *
 * 所有猪图都是 64×64 的画布、猪朝左站：鼻子在左下，耳朵在左上，尾巴在右上，脚在最下面
 * （见 docs/guides/creating-skins.md 的对齐图）。位置换算成 0–1 再分区。
 *
 * 指针位置到 0–1 的换算走 character-geometry.js：`data-walk="right"` 时图是 scaleX(-1) 翻面的，
 * 这里把 x 翻回去再分区，摸到的部位才和图上一致；可点范围仍是那个正方形布局盒。
 * @module dsh-piggy/client/pet-parts
 */
import { boxPoint, layoutPointToArt } from './character-geometry.js'

/** 每个部位摸到时冒的小东西。 */
export var PART_FX = {
  head: ['❤️'], ears: ['〰️', '❤️'], nose: ['💦'], belly: ['😆', '❤️'], back: ['✨'], tail: ['🌀'], feet: ['🐾'],
}

/**
 * @param {number} fx 0（左）–1（右）
 * @param {number} fy 0（上）–1（下）
 * @returns {string}
 */
export function partFor(fx, fy) {
  if (fy > 0.8) return 'feet'
  if (fx > 0.8 && fy < 0.45) return 'tail'
  if (fx < 0.42 && fy > 0.58) return 'nose'
  if (fx < 0.45 && fy < 0.38) return 'ears'
  if (fx < 0.5) return 'head'
  if (fy > 0.6) return 'belly'
  return 'back'
}

/**
 * 指针落在猪图的哪个部位；量不到（没有布局、点在图外）就当摸头。
 * @param {Element} pig
 * @param {{clientX?: number, clientY?: number}} event
 */
export function partAt(pig, event) {
  if (!pig || typeof pig.getBoundingClientRect !== 'function' || typeof event?.clientX !== 'number') return 'head'
  var rect = pig.getBoundingClientRect()
  if (!rect || rect.width <= 0 || rect.height <= 0) return 'head'
  // 指针判定用当下这一帧的框（玩家就是按看见的位置点的），静止布局才不许读动画中的矩形。
  var box = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  var point = { x: event.clientX, y: event.clientY }
  if (!boxPoint(box, point).inside) return 'head'
  var normalized = layoutPointToArt(box, point, { mirrored: pig.getAttribute?.('data-walk') === 'right' })
  return partFor(normalized.x, normalized.y)
}
