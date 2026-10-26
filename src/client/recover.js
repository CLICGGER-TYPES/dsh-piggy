// @ts-check
/**
 * 托盘「恢复小猪」的共用页面逻辑：只把本机显示尺寸回到默认 100%，
 * 再把「家」放到主屏右下角的安全位置。存档、气泡大小、声音、全屏等偏好都不碰。
 *
 * 位置仍沿用现有模型：猪的「家」是脚底中心，绘制包络用 bodyVisualBounds；
 * 主屏工作区边缘留现有默认内边距（desktop/geometry.js 的 PAD）。
 * split 和舞台各自用已有的位置适配器落位，这里不重复窗口换算。
 *
 * @module dsh-piggy/client/recover
 */
import { feetPoint } from './character-geometry.js'
import { drawingCorridor, PAD } from './desktop/geometry.js'
import { bodyVisualBounds } from './desktop/visual-bounds.js'
import { applyPigBox, pigSize, setPigSize } from './pig-size.js'

export const RECOVER_SCALE = 1

/** @param {unknown} value @returns {{x:number,y:number,width:number,height:number}|null} */
export function validWorkArea(value) {
  if (value === null || typeof value !== 'object') return null
  const area = /** @type {any} */ (value)
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite)) return null
  if (!(area.width > 0) || !(area.height > 0)) return null
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

/**
 * 当前显示比例可能被用户调到 500%；恢复时按 100% 的布局尺寸算，
 * 有服务端给的学段尺寸就用它，否则用「当前量到的尺寸 / 当前比例」。
 * @param {{width?:number,height?:number}} current
 * @param {number} scale
 * @param {number} [stageSize]
 * @returns {{width:number,height:number}}
 */
export function defaultPigBox(current, scale, stageSize) {
  const base = Number(stageSize)
  const old = Number(scale)
  const width = base > 0 ? base : Number(current?.width) > 0 && old > 0 ? Number(current.width) / old : 0
  const height = base > 0 ? base : Number(current?.height) > 0 && old > 0 ? Number(current.height) / old : 0
  return width > 0 && height > 0 ? { width, height } : { width: 56, height: 56 }
}

/**
 * 主屏工作区 → v3「家」（DIP 工作区 + 相对脚底）。
 * 视觉包络（动作/立绘可宽于方盒）完整留在工作区内，右下各留 PAD；
 * 工作区太小放不下时沿用 drawingCorridor 的确定性夹取，不产生反向区间。
 * @param {{pigSize:{width:number,height:number}, workArea:{x:number,y:number,width:number,height:number}, margin?:number}} input
 */
export function recoveryHome(input) {
  const area = validWorkArea(input?.workArea)
  const width = Number(input?.pigSize?.width)
  const height = Number(input?.pigSize?.height)
  if (area === null || !(width > 0) || !(height > 0)) return null
  const margin = Number.isFinite(input?.margin) && Number(input.margin) >= 0 ? Number(input.margin) : PAD
  const box = { x: 0, y: 0, width, height }
  const visual = bodyVisualBounds(box)
  const feet = feetPoint(box)
  const left = feet.x - visual.x
  const right = visual.x + visual.width - feet.x
  const top = feet.y - visual.y
  const bottom = visual.y + visual.height - feet.y
  const fit = (value, range) => Math.round(Math.max(range[0], Math.min(value, range[1])))
  const desiredX = area.x + area.width - margin - right
  const desiredY = area.y + area.height - margin - bottom
  let y = fit(desiredY, drawingCorridor([area], false, desiredX - left, desiredX + right, top, bottom, desiredY))
  let x = fit(desiredX, drawingCorridor([area], true, y - top, y + bottom, left, right, desiredX))
  y = fit(y, drawingCorridor([area], false, x - left, x + right, top, bottom, y))
  return { v: 3, area: { ...area }, x: x - area.x, y: y - area.y, foot: { x, y } }
}

/**
 * 订阅外壳的恢复事件。旧外壳没有 onRecover 时返回空清理函数，不报错、不改任何偏好。
 * 事件只做一次恢复；没有常驻定时器/标志，之后用户自己调大小照常生效。
 * @param {{
 *   role?: 'pet'|'stage'|null,
 *   shell?: any,
 *   host?: any,
 *   pig?: any,
 *   getStageSize?: () => {size?:number}|null|undefined,
 *   apply?: (home:any, size:{width:number,height:number}) => void,
 * }} options
 */
export function bindRecovery(options) {
  const none = function () {}
  if (options?.role !== 'pet' && options?.role !== 'stage') return none
  const shell = options.shell
  if (shell === null || shell === undefined || typeof shell.onRecover !== 'function') return none
  const detach = shell.onRecover(function (payload) {
    const area = validWorkArea(payload?.workArea)
    if (area === null) return
    const stageSize = Number(options.getStageSize?.()?.size)
    const size = defaultPigBox({
      width: Number(options.pig?.offsetWidth) || 0,
      height: Number(options.pig?.offsetHeight) || 0,
    }, pigSize(), stageSize > 0 ? stageSize : undefined)
    setPigSize(RECOVER_SCALE)
    applyPigBox(options.host, size.width)
    const home = recoveryHome({ pigSize: size, workArea: area })
    if (home !== null) options.apply?.(home, size)
  })
  return typeof detach === 'function' ? detach : none
}
