// @ts-check
/**
 * 变换动画不触发 DOM 观察器。只更新输入矩形，不能为了跟随墨迹而重排窗口或缩窄绘制 shape。
 * 拖动/飞行仍由原生会话拥有几何；交回页面后重新提交当前输入区域。
 */
import { collectHitRects } from '../hit-regions.js'

/** @param {{host:()=>any,shell:any,blocked:()=>boolean,onShape:(rects:any[])=>void}} deps */
export function startHitTracking(deps) {
  let lastKey = null, lastAt = -Infinity
  let active = true
  let frameId = null
  function frame(at) {
    frameId = null
    if (!active) return
    frameId = requestAnimationFrame(frame)
    if (deps.blocked()) { lastKey = null; return }
    if (Number.isFinite(at) && at - lastAt < 32) return
    lastAt = at
    const host = deps.host()
    // A disappearing mount clears its last hit region before a later mount
    // can reuse this window-level tracker.
    const hitShape = host === null ? [] : collectHitRects(host)
    const key = hitShape.map(rect => [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(',')).join(';')
    if (key === lastKey) return
    lastKey = key
    deps.onShape(hitShape)
    deps.shell.place({ hitShape })
  }
  frameId = requestAnimationFrame(frame)
  return function dispose() {
    if (!active) return
    active = false
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    lastKey = null
    deps.onShape([])
    deps.shell.place({ hitShape: [] })
  }
}
