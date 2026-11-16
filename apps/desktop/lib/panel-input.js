// @ts-check
/** 面板窗口的输入归属：固定外框命中、鼠标穿透和「点到别处」判定。 */
import { cursorHitsWindow } from './hit-physical.js'
import { panelContentRect } from './panel-geometry.js'
import { pointerHitsShape } from './pointer-hit.js'

/**
 * @param {{
 *   getPanelWindow: () => any,
 *   screen: any,
 *   platform: string,
 *   BrowserWindow: { getFocusedWindow: () => any },
 *   targetPet: () => any,
 *   extensionWindow: { current: () => any },
 *   scheduleTimeout: (callback: () => void, delay: number) => any,
 *   setInterval: (callback: () => void, delay: number) => any,
 *   clearInterval: (timer: any) => void,
 *   traceSetIgnoreMouseEvents: (role: string, mode: string, source: string, ignore: boolean, forward: boolean | 'omitted', invoke: () => void) => void,
 *   sendBlur: () => void,
 *   state: () => { open: boolean, fixed: boolean, anchor: any, size: any },
 *   recentlyShown?: () => boolean,
 * }} deps
 */
export function createPanelInput(deps) {
  let hitTimer = null
  let hit = null

  /** 固定外框只让实际卡片和名牌接收点击，透明预留区继续点到桌面。 */
  function refresh() {
    const state = deps.state()
    const window = deps.getPanelWindow()
    if (!state.fixed || !state.open || !state.anchor || window === null || window === undefined
      || window.isDestroyed() || !window.isVisible()) return
    const bounds = window.getBounds()
    // 和猪窗口同一套换算：Windows 跨屏按物理像素，其它平台保持 DIP 相减。
    const next = cursorHitsWindow({ platform: deps.platform, screen: deps.screen, window,
      shape: [panelContentRect(bounds, state.anchor, state.size)] }).hit
    if (next === hit) return
    hit = next
    deps.traceSetIgnoreMouseEvents('panel', 'panel', 'panel-hit', !next, true,
      () => window.setIgnoreMouseEvents(!next, { forward: true }))
  }

  function stop() {
    if (hitTimer !== null) deps.clearInterval(hitTimer)
    hitTimer = null
    hit = null
  }

  function start() {
    const state = deps.state()
    if (deps.platform !== 'darwin' || !state.fixed || !state.open || hitTimer !== null) return
    refresh()
    hitTimer = deps.setInterval(refresh, 16)
    hitTimer.unref?.()
  }

  /**
   * 焦点离开了面板服务的那只猪或面板窗口：如果也没落到另一个上，就是点到别处了。
   * 面板打开时不抢焦点（见 placePanel），焦点多半还在猪窗口上，所以两个窗口的失焦都要听。
   * 多猪时焦点落到别的猪也算「点到别处」。
   */
  function focusLeft() {
    if (!deps.state().open) return
    // niri 显示新面板时会抢一次焦点，猪窗口的 blur 不是「用户点到别处」；
    // 这期间发 blur 会让面板页自己 setOpen(false)，刚打开就空掉。
    if (deps.recentlyShown?.() === true) return
    deps.scheduleTimeout(() => {
      const state = deps.state()
      if (!state.open) return
      if (deps.recentlyShown?.() === true) return
      const focused = deps.BrowserWindow.getFocusedWindow()
      const pet = deps.targetPet()
      if (focused !== null && (focused === pet?.window || focused === deps.getPanelWindow() || focused === deps.extensionWindow.current())) return
      // 原生窗口重新映射时焦点可能暂空，指针仍在真实面板内不能算外部点击。
      const window = deps.getPanelWindow()
      if (focused === null && state.anchor && state.size && window !== null && window !== undefined && !window.isDestroyed() && window.isVisible()) {
        const bounds = window.getBounds()
        if (pointerHitsShape(deps.screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, state.anchor, state.size)])) return
      }
      deps.sendBlur()
    }, 0)
  }

  return { refresh, start, stop, focusLeft }
}
