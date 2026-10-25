// @ts-check
/**
 * 舞台窗口的 bounds 请求与物理校验。
 *
 * Windows 的 setBounds 按 DIP 矩形最近的显示器换算，getBounds 却按窗口所在
 * 显示器（HMONITOR）报 DIP；把两者直接比会在混合缩放下无限 setBounds。
 * 这里只比物理矩形，落地后校验一次、最多纠正一次，还不对就写日志交给实机。
 * 其他平台保持原来的 DIP 路径，一个字节都不改。
 * @module dsh-piggy-desktop/stage/window-bounds
 */
import { geometryPayload, rectsEqual, stageBounds, workAreasOf } from './geometry.js'
import { physicalStageGeometry, physicalStagePlan, rectsClose, windowPhysicalRect } from './physical.js'

const WIN32 = 'win32'

/**
 * Windows 在显示器断开时会按系统默认把跨屏窗口最小化；最小化后 getContentBounds()
 * 报 {-32000,-32000,0,0}，setBounds 也不会改变窗口。先不激活地恢复再量/设 bounds。
 * 托盘/全屏是 hide()，不是最小化，所以这里只认 isMinimized，不碰主动隐藏。
 * @param {any} win
 * @param {(...parts:any[]) => void} log
 * @param {string} why
 */
function resumeMinimizedWindow(win, log, why) {
  if (win.isMinimized?.() !== true) return false
  // Windows VM 已验证：restore() 会抢焦点，showInactive() 同样解除最小化且不激活。
  win.showInactive()
  log('bounds restore', why)
  return true
}

/**
 * 建窗用的 DIP bounds：Windows 从物理并集反推，其他平台仍是工作区 DIP 并集。
 * @param {{platform:string, displays:any[], screen:any}} value
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function stageWindowBounds(value) {
  if (value.platform === WIN32) {
    const plan = physicalStagePlan(value.displays, value.screen)
    if (plan !== null) return plan.dip
  }
  return stageBounds(value.displays)
}

/**
 * 主进程发给页面的几何：Windows 用物理 / 有效 DPR，其他平台保持原来的 DIP。
 * @param {{win:any, platform:string, displays:any[], screen:any, seq:number, interacting?:boolean, legacyPig?:{x:number,y:number}|null}} value
 */
export function stageGeometryFor(value) {
  if (value.platform === WIN32) {
    // 最小化窗口的内容矩形是原生哨兵；返回 null，让页面继续用上一份有效几何。
    if (value.win.isMinimized?.() === true) return null
    const plan = physicalStagePlan(value.displays, value.screen)
    if (plan !== null) {
      return physicalStageGeometry({ win: value.win, screen: value.screen, plan, seq: value.seq, interacting: value.interacting, legacyPig: value.legacyPig })
    }
  }
  return geometryPayload({
    window: value.win.getBounds(),
    workAreas: workAreasOf(value.displays),
    displays: value.displays,
    seq: value.seq,
    interacting: value.interacting,
    legacyPig: value.legacyPig,
  })
}

/**
 * 对齐窗口到物理工作区并集。
 * - 物理已经对得上：不动窗口（这是结束无限 setBounds 的条件）。
 * - 不对：按 null 窗口反推的 DIP setBounds 一次；80ms 后按物理校验，
 *   仍不对就纠正一次，再过 60ms 只记日志，不再 setBounds。
 * - 系统把跨屏窗口最小化时先 restore，再复用同一组 80/60ms 校验恢复；
 *   托盘/全屏的主动 hide 不是最小化，不受影响。
 * @param {{win:any, platform:string, displays:any[], screen:any, why:string, log:(...parts:any[])=>void, schedule?:(fn:()=>void, ms:number)=>any, onSettled?:()=>void}} options
 */
export function applyPhysicalStageBounds(options) {
  const { win, displays, screen, why, log } = options
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const settled = () => options.onSettled?.()
  if (options.platform !== WIN32) {
    const next = stageBounds(displays)
    if (next === null || rectsEqual(win.getBounds(), next)) return null
    win.setBounds(next)
    log('bounds', why, JSON.stringify(next))
    schedule(settled, 60)
    return { dip: next, physical: null, changed: true }
  }
  const plan = physicalStagePlan(displays, screen)
  if (plan === null) return null
  const resumed = resumeMinimizedWindow(win, log, why)
  const before = windowPhysicalRect(win, screen)
  if (rectsClose(before, plan.union, 1)) {
    // 恢复也要重新量一次：最小化解除后内容矩形才从哨兵变回真实值。
    if (resumed) schedule(settled, 60)
    return { ...plan, before, changed: resumed }
  }
  win.setBounds(plan.dip)
  log('bounds', why, JSON.stringify({ target: plan.union, dip: plan.dip, predicted: plan.physical }))
  schedule(() => {
    // 系统可能在第一次 setBounds 后才最小化窗口；在既有的 80ms 校验里恢复一次。
    const late = resumeMinimizedWindow(win, log, 'settle')
    const actual = windowPhysicalRect(win, screen)
    if (rectsClose(actual, plan.union, 1)) {
      if (late) {
        schedule(() => {
          if (resumeMinimizedWindow(win, log, 'final')) schedule(settled, 60)
          else settled()
        }, 60)
        return
      }
      settled()
      // 边界已经对上也再看一拍：系统可能在第一次校验后才把窗口最小化。
      schedule(() => {
        if (resumeMinimizedWindow(win, log, 'final')) schedule(settled, 60)
      }, 60)
      return
    }
    // 只纠正一次：WM_DPICHANGED 之类的原生缩放不能靠循环 setBounds 解决。
    win.setBounds(plan.dip)
    log('bounds corrective', JSON.stringify({ target: plan.union, actual }))
    schedule(() => {
      const finalLate = resumeMinimizedWindow(win, log, 'final')
      const final = windowPhysicalRect(win, screen)
      if (!rectsClose(final, plan.union, 1)) log('bounds unverified', JSON.stringify({ target: plan.union, actual: final }))
      if (finalLate) schedule(settled, 60)
      else settled()
    }, 60)
  }, 80)
  return { ...plan, before, changed: true }
}
