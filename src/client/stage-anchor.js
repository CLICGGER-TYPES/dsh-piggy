// @ts-check
/**
 * 舞台的脚底锚点：host 钉在 right/bottom 上，猪自己的宽高却可能在第一次
 * 采纳共享家之后才变成实际值（视图晚到、长大、换皮肤、宿主内边距变化）。
 * 宽高一变，右对齐的猪中心就横着挪，存档里的家却没变。
 *
 * 这里只记「脚底到 host 右下锚边的距离」；内层布局变化时把 right/bottom
 * 反向补回来：
 *   - 拖动、抛掷只挪 host，猪和 host 的偏移一起变，锚距不变；
 *   - 手感/呼吸只改 transform，layoutBox 量的是 offset 布局盒，看不见；
 *   - 面板开合只改 host 宽度，右对齐时锚距也不变（会自然算成 0）。
 * @module dsh-piggy/client/stage-anchor
 */
import { layoutBox } from './stage-dom.js'

/** 半个像素以内是布局噪声；right/bottom 存整数，不值得为它写回一次。 */
export const ANCHOR_SLACK = 0.5

/**
 * 脚底中心到 host 右/下锚边的距离。
 * @param {{x:number,y:number,width:number,height:number}} pigBox
 * @param {{x:number,y:number,width:number,height:number}} hostBox
 */
export function footAnchor(pigBox, hostBox) {
  return {
    right: hostBox.width - (pigBox.x - hostBox.x) - pigBox.width / 2,
    bottom: hostBox.height - (pigBox.y - hostBox.y) - pigBox.height,
  }
}

/**
 * 为了让脚底留在同一屏幕点，right/bottom 各要加多少。
 * 锚距变大 → right/bottom 要变小，所以用前后差值。
 * @param {{right:number,bottom:number}|null} previous
 * @param {{right:number,bottom:number}} next
 * @param {number} [slack]
 */
export function anchorAdjustment(previous, next, slack = ANCHOR_SLACK) {
  if (previous === null || previous === undefined || next === null || next === undefined) return null
  const right = previous.right - next.right
  const bottom = previous.bottom - next.bottom
  return Math.abs(right) <= slack && Math.abs(bottom) <= slack ? null : { right, bottom }
}

/**
 * 记住上次落位的布局盒，内层尺寸变化时给出位移补正。
 * @param {any} pig @param {any} host
 * @param {(shift:{right:number,bottom:number})=>void} shift
 */
export function createStageAnchor(pig, host, shift) {
  let previous = null
  const measure = () => footAnchor(layoutBox(pig), layoutBox(host))
  return {
    remember() { previous = measure() },
    restore() {
      const next = measure()
      const adjustment = anchorAdjustment(previous, next)
      previous = next
      if (adjustment !== null) shift(adjustment)
    },
  }
}
