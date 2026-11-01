// @ts-check
/**
 * 变换动画不触发 DOM 观察器。只更新输入矩形，不能为了跟随墨迹而重排窗口或缩窄绘制 shape。
 * 拖动/飞行仍由原生会话拥有几何；交回页面后重新提交当前输入区域。
 */
import { collectHitRects } from '../hit-regions.js'

/** @param {{host:()=>any,shell:any,blocked:()=>boolean,onShape:(rects:any[])=>void,windowObject?:Window}} deps */
export function startHitTracking(deps) {
  let lastKey = '', lastAt = -Infinity
  let stopped = false
  let frameId = null
  const requestFrame = deps.windowObject?.requestAnimationFrame?.bind(deps.windowObject)
    ?? requestAnimationFrame
  const cancelFrame = deps.windowObject?.cancelAnimationFrame?.bind(deps.windowObject)
    ?? globalThis.cancelAnimationFrame?.bind(globalThis)
    ?? (() => {})

  function frame(at) {
    if (stopped) return
    frameId = requestFrame(frame)
    if (deps.blocked()) { lastKey = ''; return }
    if (Number.isFinite(at) && at - lastAt < 32) return
    lastAt = at
    const host = deps.host()
    if (host === null) return
    const hitShape = collectHitRects(host)
    const key = hitShape.map(rect => [rect.x, rect.y, rect.width, rect.height].map(Math.round).join(',')).join(';')
    if (key === lastKey) return
    lastKey = key
    deps.onShape(hitShape)
    deps.shell.place({ hitShape })
  }
  frameId = requestFrame(frame)
  return function stop() {
    if (stopped) return
    stopped = true
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
  }
}
