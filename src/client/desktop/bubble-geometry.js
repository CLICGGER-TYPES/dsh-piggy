// @ts-check
/**
 * Keep a speech bubble inside the drawable part of the existing pet window.
 * The scene may slide when the pig reaches a desktop edge; its speech must not
 * inherit that clipping. This never changes the window or the bubble's width.
 * If the intersection is narrower than the bubble, align its left edge; full
 * containment would require a separate width/layout decision.
 * All inputs use window-local CSS pixels.
 *
 * 锚点不做第二次推导：头顶中心、脚底中心、尾巴内缩都来自 character-geometry.js，
 * 和桌面猪窗口量气泡、桌面「家」用同一条脚底/头顶合同。
 */
import { BUBBLE_GAP, bubbleTailLeft, feetPoint, headTopPoint } from '../character-geometry.js'

/**
 * @param {{x:number,width:number}} bubble
 * @param {{x:number,width:number}} pig pig layout box (only x/width are read)
 * @param {{x:number,width:number}} windowBounds
 * @param {{x:number,width:number}} workArea
 */
export function fitBubbleHorizontally(bubble, pig, windowBounds, workArea) {
  const left = Math.max(0, workArea.x - windowBounds.x) + 6
  const right = Math.min(windowBounds.width, workArea.x + workArea.width - windowBounds.x) - 6
  const x = Math.max(left, Math.min(bubble.x, Math.max(left, right - bubble.width)))
  const head = headTopPoint(pig)
  return { x, tailLeft: bubbleTailLeft({ x, width: bubble.width }, head) }
}

/**
 * Keep speech above its pig, using the approved below-pig position if the
 * upper space is unavailable. Coordinates are window-local CSS pixels.
 * @param {{y:number,height:number}} bubble
 * @param {{y:number,height:number}} pig pig layout box (only y/height are read)
 * @param {{y:number,height:number}} windowBounds
 * @param {{y:number,height:number}} workArea
 */
export function fitBubbleVertically(bubble, pig, windowBounds, workArea) {
  const top = Math.max(0, workArea.y - windowBounds.y) + 6
  const bottom = Math.min(windowBounds.height, workArea.y + workArea.height - windowBounds.y) - 6
  const aboveFits = bubble.y >= top && bubble.y + bubble.height <= bottom
  const below = feetPoint(pig).y + BUBBLE_GAP
  if (!aboveFits && below >= top && below + bubble.height <= bottom) return { y: below, side: 'below' }
  return { y: bubble.y, side: 'above' }
}
