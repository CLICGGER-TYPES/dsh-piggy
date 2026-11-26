// @ts-check
/**
 * 猪窗口的可见性判断：布局算完以后，猪必须落在原生窗口（surface）里，否则
 * 原生形状会把它整块裁掉 —— 2026-11-26 那只「桌面上看不到猪」就是
 * pigBox.x = -100、窗口 x = 161，猪画在 368px 宽的 surface 左边界外。
 *
 * 只做几何，不碰 DOM：拖动/抛掷的 slide 与窗口夹取补偿叠加后内容被永久推偏，
 * 这里给布局循环一个「偏了就重来」的判据。
 */

/** 取整误差：窗口/布局都是整数，1px 以内不算越界。 */
const TOLERANCE = 1

/**
 * 猪的布局盒是否完整落在窗口里。
 * 没有窗口几何（宽高 <= 0）时不做判断：宁可不动，也不要按假坐标摆。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{width:number,height:number}} win
 */
export function pigInsideWindow(box, win) {
  if (box === null || box === undefined || win === null || win === undefined) return false
  if (!(Number(win.width) > 0) || !(Number(win.height) > 0)) return true
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)) return false
  return box.x >= -TOLERANCE && box.y >= -TOLERANCE
    && box.x + box.width <= win.width + TOLERANCE
    && box.y + box.height <= win.height + TOLERANCE
}

/**
 * 猪与窗口的交集面积（px²）。用来在日志里区分「完整在里面」「压在边上」
 * 「整个在外面」——只看 pigBox.x 的符号在多屏/取整时会骗人。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{width:number,height:number}} win
 */
export function pigWindowIntersection(box, win) {
  if (box === null || box === undefined || win === null || win === undefined) return 0
  const width = Number(win.width) || 0
  const height = Number(win.height) || 0
  if (width <= 0 || height <= 0) return 0
  const left = Math.max(0, Number(box.x) || 0)
  const top = Math.max(0, Number(box.y) || 0)
  const right = Math.min(width, (Number(box.x) || 0) + (Number(box.width) || 0))
  const bottom = Math.min(height, (Number(box.y) || 0) + (Number(box.height) || 0))
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

/**
 * 日志/测试共用的一份可见性摘要。
 * shown 是页面自己知道的「窗口该不该显示」（document.visibilityState），
 * 不冒充原生 mapped 状态；两者一起看才能分清「被画到画布外」和「窗口没显示」。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{width:number,height:number}} win
 * @param {boolean} [shown]
 */
export function pigVisibility(box, win, shown = true) {
  const intersect = pigWindowIntersection(box, win)
  return {
    intersect,
    inside: pigInsideWindow(box, win),
    visible: intersect > 0,
    shown: shown === true,
  }
}
