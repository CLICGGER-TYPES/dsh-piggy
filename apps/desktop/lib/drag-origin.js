// @ts-check
/**
 * 校验页面给的拖动起点（pointerdown 的屏幕坐标）。
 *
 * 页面延迟到移动 4px 才发 drag:start；快速甩动时第一帧就可能离 pointerdown
 * 上百像素。以前只接受距离当前光标 32px 以内的 origin，快速拖动会退回当前光标，
 * 窗口因此永远落后手指一段（用户看到的「拖快了就丢/跟不上」）。
 * 这里放宽到 512px，但仍要求点有限、在当前屏工作区内；真正离谱的消息才退回当前光标。
 * @param {{x:number,y:number}|null|undefined} origin
 * @param {{x:number,y:number}} cursor 主进程刚读到的光标
 * @param {{x:number,y:number,width:number,height:number}} area origin 所在屏的工作区
 * @param {number} [maxDistance]
 * @returns {{x:number,y:number}|null}
 */
export function validDragOrigin(origin, cursor, area, maxDistance = 512) {
  if (origin === null || origin === undefined) return null
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return null
  if (!Number.isFinite(cursor?.x) || !Number.isFinite(cursor?.y)) return null
  if (Math.hypot(origin.x - cursor.x, origin.y - cursor.y) > maxDistance) return null
  if (!area || !Number.isFinite(area.x) || !Number.isFinite(area.y)
    || !Number.isFinite(area.width) || !Number.isFinite(area.height)) return null
  if (origin.x < area.x || origin.x >= area.x + area.width
    || origin.y < area.y || origin.y >= area.y + area.height) return null
  return { x: Math.round(origin.x), y: Math.round(origin.y) }
}
