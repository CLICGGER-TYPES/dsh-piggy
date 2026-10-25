// @ts-check
/** Windows全屏探测与舞台坐标共用的物理显示器矩形判断。 */
/** 两个物理矩形是不是同一块显示器（PS 的 rcMonitor 与 Electron 换算可能差 1~2px）。 */
export function samePhysicalMonitor(a, b) {
  const edges = rect => [Math.round(rect.x) + 0, Math.round(rect.y) + 0,
    Math.round(rect.x + rect.width) + 0, Math.round(rect.y + rect.height) + 0]
  const [ax, ay, ar, ab] = edges(a)
  const [bx, by, br, bb] = edges(b)
  const tolerance = 2
  return Math.abs(ax - bx) <= tolerance && Math.abs(ay - by) <= tolerance
    && Math.abs(ar - br) <= tolerance && Math.abs(ab - bb) <= tolerance
}

/** @param {any} value @returns {boolean} */
export function isPhysicalRect(value) {
  return value !== null && typeof value === 'object'
    && [value.x, value.y, value.width, value.height].every(Number.isFinite)
    && value.width > 0 && value.height > 0
}

