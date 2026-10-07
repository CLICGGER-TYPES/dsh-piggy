// @ts-check
/**
 * 面板窗口摆哪（外壳 0.6.1 起从 main.js 搬出来，纯函数，不碰 Electron）。
 *
 * 规矩只有一条：面板的位置**每次都从猪现在在哪直接算**，绝不在面板窗口上一次的位置上加增量。
 * 0.6.0 拖动时是「面板窗口回读位置 + 猪这一帧挪了多少」：Windows 上拖动中窗口回读常落后一两帧
 * （setBounds 还没生效就读），分数缩放下还带 1px 取整误差，每帧丢一点，一秒几十帧累加下来
 * 面板被猪越甩越远（用户 2026-10-07 录屏：面板落在原地附近，猪已经拖到屏幕另一头）。
 *
 * 尺寸常量和游戏包 src/client/constants.js 的同名常量必须一致（test/panel-geometry.test.js 核对）。
 */

/** 面板和猪隔多远。 */
export const PANEL_GAP = 8
/** 面板离屏幕边至少多远。 */
export const PANEL_MARGIN = 10
export const PANEL_MAX_HEIGHT = 520
export const PANEL_MIN_HEIGHT = 120
/** 面板页面还没报尺寸之前先按这个大小摆（宽度 = 卡片宽）。 */
export const PANEL_FALLBACK = Object.freeze({ width: 292, height: 420 })

/**
 * 不在拖动时，回读的窗口位置和请求的差多少以内算「取整误差」：这么近就信请求值，
 * 差得更远说明系统真没照办（比如窗口管理器把窗口推回屏幕里），只能信回读值。
 * 拖动中一律信请求值：那时回读落后是常态，而请求值本身已经夹在工作区里了。
 */
export const READBACK_NOISE = 3

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */

/**
 * 猪在屏幕上的框。
 * @param {{x:number,y:number}|null} asked 最近一次请求给猪窗口的位置（没有就是 null）
 * @param {{x:number,y:number}} read 猪窗口回读的位置
 * @param {Rect} pig 猪在猪窗口里的框
 * @param {{dragging?: boolean, slide?: {x:number,y:number}}} [options] 拖动中没有；slide 是拖到屏幕边时猪在窗口里滑出去的那一截
 * @returns {Rect}
 */
export function pigScreenBox(asked, read, pig, options = {}) {
  const slide = options.slide ?? { x: 0, y: 0 }
  const near = asked !== null && (options.dragging === true
    || (Math.abs(asked.x - read.x) <= READBACK_NOISE && Math.abs(asked.y - read.y) <= READBACK_NOISE))
  const at = near ? asked : read
  return { x: at.x + pig.x + slide.x, y: at.y + pig.y + slide.y, width: pig.width, height: pig.height }
}

/**
 * 面板朝哪边开、最高多高、和猪哪边对齐（开面板和松手时定，拖动中不改）：
 * 上面空间大就往上，否则往下（和网页版 fitPanel 一个规则）；右边对齐猪放得下就右对齐，否则左对齐。
 * 拖动中不换对齐边：换一次面板就横跳一个面板宽（2026-10-07 虚拟机录像里拖到左边时跳了 330px），
 * 拖动中放不下就让面板停在屏幕边，松手再重新定；松手时原来那边还放得下就不换（不然松手一下面板横跳）。
 * @param {Rect} pig 猪在屏幕上的框
 * @param {Rect} area 猪所在那块屏的工作区
 * @param {number} [width] 面板宽
 * @param {string} [keep] 现在是哪边对齐（放得下就保持）
 */
export function panelAnchorFor(pig, area, width = PANEL_FALLBACK.width, keep = undefined) {
  const above = pig.y - area.y
  const below = area.y + area.height - (pig.y + pig.height)
  const vertical = above >= below ? 'above' : 'below'
  const room = (vertical === 'above' ? above : below) - PANEL_GAP - PANEL_MARGIN
  const rightFits = pig.x + pig.width - width >= area.x + PANEL_MARGIN
  const leftFits = pig.x + width <= area.x + area.width - PANEL_MARGIN
  const horizontal = keep === 'left' && leftFits ? 'left' : keep === 'right' && rightFits ? 'right' : rightFits ? 'right' : 'left'
  return { vertical, horizontal, maxHeight: Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(room))), area }
}

/**
 * 面板窗口该在哪：竖向贴着猪（上方时底边贴猪头，下方时顶边贴猪脚），
 * 横向按定好的那边和猪对齐，最后夹进工作区。
 * @param {Rect} pig 猪在屏幕上的框
 * @param {{vertical:string, horizontal?:string, area:Rect}} anchor
 * @param {{width:number,height:number}|null} size 面板页面报的尺寸
 * @returns {Rect}
 */
export function panelBoundsFor(pig, anchor, size) {
  const area = anchor.area
  const width = Math.round(size?.width ?? PANEL_FALLBACK.width)
  const height = Math.round(Math.min(size?.height ?? PANEL_FALLBACK.height, area.height - 2 * PANEL_MARGIN))
  let x = anchor.horizontal === 'left' ? Math.round(pig.x) : Math.round(pig.x + pig.width - width)
  x = Math.max(area.x + PANEL_MARGIN, Math.min(x, area.x + area.width - width - PANEL_MARGIN))
  let y = anchor.vertical === 'above' ? Math.round(pig.y - PANEL_GAP - height) : Math.round(pig.y + pig.height + PANEL_GAP)
  y = Math.max(area.y, Math.min(y, area.y + area.height - height))
  return { x, y, width, height }
}
