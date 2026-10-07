// @ts-check
/**
 * 桌面版外壳（apps/desktop）的标志。
 *
 * 外壳把窗口缩到猪身上，位置归它管；页面里只保留内边距。网页版没有这个对象，
 * 调用处据此走原路（见 index.js 的拖动、layout.js 的 fitPanel）。
 * @module dsh-piggy/client/desktop-shell
 */

/** @returns {any} 外壳对象；不在桌面版里就是 null。 */
export function desktopShell() {
  var shell = typeof window !== 'undefined' ? (/** @type {any} */ (window)).__dshPiggyShell : null
  return shell !== null && typeof shell === 'object' &&
    (typeof shell.beginDrag === 'function' || typeof shell.moveBy === 'function') ? shell : null
}

/**
 * 桌面版外壳 0.6.0 起，猪和面板各在一个窗口里，同一份游戏包两边都跑：
 * 'pet'（猪窗口：只有猪和气泡）、'panel'（面板窗口：只有面板）。老外壳单窗口，返回 null。
 * @returns {'pet'|'panel'|null}
 */
export function desktopRole() {
  var shell = desktopShell()
  var role = shell === null ? null : shell.role
  return role === 'pet' || role === 'panel' ? role : null
}
