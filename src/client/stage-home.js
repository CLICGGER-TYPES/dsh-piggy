// @ts-check
/**
 * 跨模式的「猪的家」→ 舞台 right/bottom（纯函数；localStorage 读写留在 stage-bridge）。
 *
 * split 与舞台写同一个键 `dsh-piggy:desktop-pig`：split 拖动/散步后写它，舞台每次
 * setPosition 也写它。只认一次就变成单向同步 —— split 里挪过猪再进舞台，猪回到更早的
 * 舞台位置，随后舞台的任何一次写回又把 split 刚存的家覆盖掉。
 *
 * 这里改成每次挂载/几何更新都对齐那个家：
 *   - 家与当前 right/bottom 一致（±POSITION_SYNC_SLACK，存档只存整数）→ 不用动；
 *   - 家更新过（split 挪了猪）→ 采纳它；
 *   - 没有可用的家时，才允许用旧窗口文件里的位置（只一次，调用方记账）。
 *
 * 舞台写回时总把同一个家一起更新，所以「自己写的家」永远与当前位置一致，不会来回弹。
 * @module dsh-piggy/client/stage-home
 */
import { legacyHomeRect, positionForScreenRect, savedHomeRect } from './stage-position.js'

/** 桌面版（split）的猪的家：v3 存相对所在工作区的脚底中心。 */
export const DESKTOP_HOME_KEY = 'dsh-piggy:desktop-pig'

/** @typedef {{source:'home'|'legacy'|'none', position:{right:number,bottom:number}|null}} StageHome */

/**
 * @param {{
 *   homeRaw?: any, legacyPig?: any, allowLegacy?: boolean,
 *   pigSize: {width:number,height:number}, hostBox: any, pigBox: any, geometry: any, current?: any,
 * }} input
 * @returns {StageHome}
 */
export function resolveStageHome(input) {
  /** @type {StageHome} */
  const none = { source: 'none', position: null }
  if (!input || !input.geometry || !input.geometry.window) return none
  const home = savedHomeRect(input.homeRaw, input.pigSize, input.geometry)
  if (home !== null) {
    const position = positionForScreenRect(home, input.hostBox, input.pigBox, input.geometry.window, input.current ?? null)
    return { source: 'home', position }
  }
  if (input.allowLegacy !== true) return none
  const legacy = legacyHomeRect(input.legacyPig, input.pigSize, input.geometry)
  if (legacy === null) return none
  return { source: 'legacy', position: positionForScreenRect(legacy, input.hostBox, input.pigBox, input.geometry.window) }
}
