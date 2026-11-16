// @ts-check
/**
 * niri 下面板窗口的桥：首帧透明等待、真实位置查询、按最新目标移动。
 *
 * 面板窗口的 BrowserWindow 生命周期仍在 lib/panel-window.js；这里只维护 niri 句柄、
 * 合并后的目标位置和 opacity 保护，避免 panel-controller 继续膨胀。
 */
import { NIRI_APP_ID, PANEL_TITLE } from './niri-window.js'

/**
 * @param {{
 *   niri: ReturnType<typeof import('./niri-client.js').createNiriWindow> | null,
 *   getPanelWindow: () => any,
 *   log: (...parts: any[]) => any,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   clearTimeout?: typeof globalThis.clearTimeout,
 * }} deps
 */
export function createNiriPanelWindow(deps) {
  const niri = deps.niri
  const enabled = niri?.enabled === true
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const clearTimer = deps.clearTimeout ?? clearTimeout
  let handle = null
  let timer = null
  let attempts = 0
  let opacityHeld = false
  /** 最近一次要去的物理位置；重试定时器必须用最新目标，不能用第一次的闭包。 */
  let target = null

  function handleFor() {
    if (!enabled) return null
    const window = deps.getPanelWindow()
    if (window === null || window === undefined || window.isDestroyed()) return null
    if (handle !== null) return handle
    const bounds = window.getBounds()
    handle = niri.watch({ title: PANEL_TITLE, appId: NIRI_APP_ID, width: bounds.width, height: bounds.height })
    return handle
  }

  function restoreOpacity() {
    if (!opacityHeld) return
    opacityHeld = false
    const window = deps.getPanelWindow()
    if (window !== null && window !== undefined && !window.isDestroyed()) {
      try { window.setOpacity(1) } catch { /* 窗口刚被销毁 */ }
    }
  }

  /** 先透明，等 niri 把面板搬离默认位置（常在猪身上）再显示。 */
  function hold() {
    if (!enabled) return false
    const window = deps.getPanelWindow()
    if (window === null || window === undefined || window.isDestroyed() || opacityHeld) return false
    try {
      window.setOpacity(0)
      opacityHeld = true
      return true
    } catch { return false }
  }

  function cancel() {
    if (timer !== null) clearTimer(timer)
    timer = null
    attempts = 0
    target = null
    restoreOpacity()
  }

  function reset() {
    cancel()
    handle = null
  }

  /** 查询面板在 niri 里的当前真实位置（拖动松手后对账用）。 */
  function refresh() {
    if (!enabled) return null
    const current = handleFor()
    return current === null ? null : niri.refresh(current)
  }

  /**
   * 跨输出后 niri/XWayland 可能仍按旧输出的 scale 换算窗口尺寸（292 物理变成 194 逻辑）。
   * 先按目标物理尺寸提交一次，再按回读比例补偿，保证面板在目标屏上视觉大小不变。
   */
  function reapplySize(next) {
    const window = deps.getPanelWindow()
    const current = handle
    if (window === null || window === undefined || window.isDestroyed() || current === null) return
    const read = window.getBounds()
    window.setBounds({ x: read.x, y: read.y, width: next.width, height: next.height })
    if (niri.refresh(current) === null) return
    if (Math.abs(current.rect.width - next.width) <= 2 && Math.abs(current.rect.height - next.height) <= 2) return
    const scale = Number(current.scale) || 1
    const ratioX = read.width / Math.max(1, current.rect.width)
    const ratioY = read.height / Math.max(1, current.rect.height)
    window.setBounds({
      x: read.x, y: read.y,
      width: Math.round(next.width * ratioX / scale), height: Math.round(next.height * ratioY / scale),
    })
    niri.refresh(current)
  }

  /**
   * 面板窗口刚显示时 niri 还没把它列出来：每 16–160ms 查一次，认到后按最新目标搬过去。
   * 成功前保持 opacity 0，避免先在默认位置闪一帧。
   */
  function sync(next) {
    if (!enabled) return
    if (next !== null && next !== undefined) target = next
    if (target === null || target === undefined) return
    const current = handleFor()
    const window = deps.getPanelWindow()
    if (current === null || window === null || window === undefined || window.isDestroyed()) { restoreOpacity(); return }
    const found = niri.refresh(current)
    if (found === null) {
      attempts += 1
      if (attempts > 10) {
        restoreOpacity()
        deps.log('panel niri window not found', JSON.stringify({ attempts, asked: target }))
        return
      }
      if (timer === null) {
        timer = scheduleTimeout(() => {
          timer = null
          sync(target)
        }, Math.min(160, 16 + attempts * 16))
        timer?.unref?.()
      }
      return
    }
    attempts = 0
    const beforeOutput = current.output
    niri.moveTo(current, target)
    const crossed = current.output !== beforeOutput
    void niri.flush().then(() => {
      if (crossed) reapplySize(target)
      restoreOpacity()
    }, restoreOpacity)
  }

  /** 面板已经显示时的常规跟随：有真实句柄就直接发增量，否则走一次带重试的 sync。 */
  function moveTo(next) {
    if (!enabled) return false
    target = next
    const current = handleFor()
    if (current !== null && current.id !== null && current.rect !== null) {
      const beforeOutput = current.output
      const moved = niri.moveTo(current, next)
      if (moved && current.output !== beforeOutput) {
        void niri.flush().then(() => reapplySize(next), () => reapplySize(next))
      }
      return moved
    }
    sync(next)
    return true
  }

  return { enabled, hold, cancel, reset, refresh, sync, moveTo }
}
