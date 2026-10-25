// @ts-check
/**
 * 气泡放在哪：复用桌面版已经确认过的 fitBubbleHorizontally / fitBubbleVertically
 * （src/client/desktop/bubble-geometry.js）和 character-geometry 的头顶/脚底锚点。
 *
 * 整屏舞台里没有桌面量窗流程，猪停在屏幕顶上时气泡仍会按 CSS 往上开、被窗口顶裁掉。
 * 这里只算气泡的位置：不改宽度、不挪猪、不改正文；返回的目标矩形由调用方写样式。
 *
 * 输入输出都是页面坐标（舞台窗口的 client 像素）；`window`/`workArea` 用同一套坐标，
 * 调用方把屏幕工作区减去窗口原点即可。
 * @module dsh-piggy/client/bubble-fit
 */
import { bubbleSlot, characterGeometry } from './character-geometry.js'
import { fitBubbleHorizontally, fitBubbleVertically } from './desktop/bubble-geometry.js'
import { PANEL_GAP, PANEL_MARGIN, PANEL_MAX_HEIGHT } from './constants.js'

/** Keep a below-pig panel clear of below-pig speech, shrinking its scroll area. */
export function fitPanelBelowSpeech(panel, bubble, pig, workArea) {
  if (panel.y < pig.y + pig.height || !intersects(panel, bubble)) return null
  const top = Math.ceil(bubble.y + bubble.height + PANEL_GAP)
  const maxHeight = Math.floor(workArea.y + workArea.height - PANEL_MARGIN - top)
  if (maxHeight < 32) return null
  return { y: top, maxHeight }
}

/**
 * Keep an above-pig panel clear of above-pig speech. Moving the panel up keeps
 * its height; only when the work area has no room for that does the returned
 * maxHeight shrink the scroll area. The pig and bubble are never moved.
 *
 * `y` is the top when the full maxHeight is used. The caller anchors the panel's
 * bottom to `y + maxHeight`, so shorter content keeps the same 8px gap and content
 * that grows later extends upward instead of back over the bubble.
 */
export function fitPanelAboveSpeech(panel, bubble, pig, workArea) {
  if (bubble.y + bubble.height > pig.y || !intersects(panel, bubble)) return null
  const bottom = Math.floor(bubble.y - PANEL_GAP)
  const top = Math.ceil(workArea.y + PANEL_MARGIN)
  const room = bottom - top
  if (room < 32) return null
  const maxHeight = Math.floor(Math.min(PANEL_MAX_HEIGHT, room))
  return { y: bottom - maxHeight, maxHeight }
}

/** @param {{x:number,y:number,width:number,height:number}} a @param {{x:number,y:number,width:number,height:number}} b */
function intersects(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * @param {{
 *   bubble: {x:number,y:number,width:number,height:number},
 *   pig: {x:number,y:number,width:number,height:number},
 *   window: {x:number,y:number,width:number,height:number},
 *   workArea: {x:number,y:number,width:number,height:number},
 *   menu?: {x:number,y:number,width:number,height:number}|null,
 * }} input
 * @returns {{x:number,y:number,width:number,height:number,side:'above'|'below',tailLeft:number,clipped:boolean}}
 */
export function fitSpeechPlacement(input) {
  const bubble = input.bubble
  const width = Math.max(0, Number(bubble.width) || 0)
  const height = Math.max(0, Number(bubble.height) || 0)
  const anchors = characterGeometry(input.pig)
  const aboveY = bubbleSlot(anchors, 'above', { width: width, height: height }).y
  const belowY = bubbleSlot(anchors, 'below', { width: width, height: height }).y

  const horizontal = fitBubbleHorizontally({ x: bubble.x, width: width }, input.pig, input.window, input.workArea)
  const vertical = fitBubbleVertically({ y: aboveY, height: height }, input.pig, input.window, input.workArea)
  let y = vertical.y
  /** @type {'above'|'below'} */
  let side = vertical.side === 'below' ? 'below' : 'above'

  // 菜单避让：气泡在猪上方时正好压在打开的面板上，就改到脚底下方（放得下才改）。
  if (side === 'above' && input.menu) {
    const top = Math.max(0, input.workArea.y - input.window.y) + 6
    const bottom = Math.min(input.window.height, input.workArea.y + input.workArea.height - input.window.y) - 6
    const box = { x: horizontal.x, y: y, width: width, height: height }
    if (intersects(input.menu, box) && belowY >= top && belowY + height <= bottom) {
      y = belowY
      side = 'below'
    }
  }

  return {
    x: horizontal.x,
    y: y,
    width: width,
    height: height,
    side: side,
    tailLeft: horizontal.tailLeft,
    clipped: side !== 'above' || Math.abs(horizontal.x - bubble.x) >= 0.5,
  }
}
