// @ts-check
/**
 * 窗口管理器夹住窗口时的收敛判定。
 *
 * X11/Mutter 在混合缩放的多屏上可能不接受页面算出的窗口位置：setBounds 之后
 * 实际位置仍是旧的/被夹过的值。页面每一轮都会从「家」重新算出同一个目标，
 * 于是形成 `place → 被夹 → 再 place` 的死循环。
 *
 * 这里只做一件事：同一个目标连续失败达到上限后，告诉调用方「接受实际位置」。
 * 不在第一帧就接受 —— X11 的 setBounds 是异步的，刚开始的一两帧回读可能还是旧值。
 * @module dsh-piggy/client/desktop/window-clamp
 */

const TOLERANCE = 2
const DEFAULT_LIMIT = 6

/** @param {{x:number,y:number,width:number,height:number}} a @param {{x:number,y:number,width:number,height:number}} b */
function same(a, b) {
  return Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE
    && Math.abs(a.width - b.width) <= TOLERANCE && Math.abs(a.height - b.height) <= TOLERANCE
}

/** 按 2px 量化成 key：读回值的 1px 噪声不算「新目标」。 */
function key(rect) {
  return [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value / TOLERANCE)).join(',')
}

/**
 * @param {number} [limit] 连续失败多少次后接受实际位置。
 */
export function createWindowClamp(limit = DEFAULT_LIMIT) {
  let wantKey = null
  let actualKey = null
  let attempts = 0

  return {
    /**
     * @param {{x:number,y:number,width:number,height:number}} want 页面请求的窗口
     * @param {{x:number,y:number,width:number,height:number}} actual 主进程回读的实际窗口
     * @returns {'ok'|'retry'|'accept'}
     */
    observe(want, actual) {
      if (same(want, actual)) {
        wantKey = null
        actualKey = null
        attempts = 0
        return 'ok'
      }
      const nextWant = key(want)
      const nextActual = key(actual)
      if (nextWant === wantKey && nextActual === actualKey) attempts += 1
      else {
        wantKey = nextWant
        actualKey = nextActual
        attempts = 1
      }
      return attempts >= limit ? 'accept' : 'retry'
    },
    reset() {
      wantKey = null
      actualKey = null
      attempts = 0
    },
    attempts() { return attempts },
  }
}
