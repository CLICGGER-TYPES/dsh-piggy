// @ts-check
/**
 * 托盘「恢复小猪」的外壳侧纯函数：主屏 DIP 工作区校验，以及页面还没接上恢复事件时
 * 先把窗口挪回可见位置的兜底。窗口留白沿用现有的 WINDOW_PADDING。
 * @module dsh-piggy-desktop/lib/pig-recovery
 */
import { MIN_WINDOW, WINDOW_PADDING, clampBounds } from './window-geometry.js'

/** @param {any} display */
export function recoveryPayload(display) {
  const area = display?.workArea
  if (area === null || area === undefined) return null
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite)) return null
  if (!(area.width > 0) || !(area.height > 0)) return null
  return { workArea: { x: area.x, y: area.y, width: area.width, height: area.height } }
}

/**
 * 以当前窗口大小放到主屏右下角；500% 时窗口可能比工作区大，仍按现有
 * clampBounds 贴左上，至少让一部分猪可见。页面接上事件后会再按 100% 重算。
 * @param {{x:number,y:number,width:number,height:number}} bounds
 * @param {{x:number,y:number,width:number,height:number}} area
 */
export function recoverBounds(bounds, area) {
  const width = Math.max(MIN_WINDOW.width, Math.round(Number(bounds?.width) || 0))
  const height = Math.max(MIN_WINDOW.height, Math.round(Number(bounds?.height) || 0))
  return clampBounds({
    x: area.x + area.width - width - WINDOW_PADDING,
    y: area.y + area.height - height - WINDOW_PADDING,
    width,
    height,
  }, area)
}
