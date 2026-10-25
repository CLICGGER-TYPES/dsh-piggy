// @ts-check
/**
 * 舞台形状消息的纯函数：页面报什么、主进程信什么、什么时候不重复设。
 *
 * Linux 的 setShape 同时决定「可点」和「绘制」；Windows/macOS 只拿这份矩形做鼠标命中。
 * 所以形状必须来自页面真实布局，主进程只做数字清洗和去重，不猜猪在哪。
 * @module dsh-piggy-desktop/stage/shape
 */

/** 一份形状最多 64 个矩形（和现有 piggy:place/piggy:content 的上限一致）。 */
export const MAX_SHAPE_RECTS = 64
const MAX_BYTES = 128 * 1024 * 1024
/** 页面 dpr / CSS 视口的合理范围；坏元数据整条不用，不拿它裁形状。 */
const DPR_MIN = 0.25
const DPR_MAX = 8
const VIEWPORT_MAX = 20000

/**
 * 页面报来的单个矩形：只接受有限数字，裁到窗口里，小于 1px 丢弃。
 * @param {any} value
 * @param {{width:number,height:number}} bounds
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function sanitizeRect(value, bounds) {
  if (value === null || typeof value !== 'object') return null
  const x = Math.round(Number(value.x))
  const y = Math.round(Number(value.y))
  const width = Math.round(Number(value.width))
  const height = Math.round(Number(value.height))
  if (![x, y, width, height].every(Number.isFinite)) return null
  if (width < 1 || height < 1) return null
  const left = Math.max(0, Math.min(Math.max(0, bounds.width - 1), x))
  const top = Math.max(0, Math.min(Math.max(0, bounds.height - 1), y))
  const right = Math.max(left + 1, Math.min(bounds.width, x + width))
  const bottom = Math.max(top + 1, Math.min(bounds.height, y + height))
  if (right <= left || bottom <= top) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * 整份形状清洗。空形状保留为空（页面还没量到时主进程会维持 1px/穿透）。
 * @param {any} input
 * @param {{width:number,height:number}} bounds
 * @param {number} [limit]
 */
export function sanitizeShape(input, bounds, limit = MAX_SHAPE_RECTS) {
  if (!Array.isArray(input) || bounds === null || typeof bounds !== 'object') return []
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width < 1 || bounds.height < 1) return []
  const out = []
  for (const item of input.slice(0, Math.max(0, limit))) {
    const rect = sanitizeRect(item, bounds)
    if (rect !== null) out.push(rect)
  }
  return out
}

/**
 * 只保留约定好的可见范围键，避免页面任意对象进入日志/指标。
 * @param {any} input
 * @param {{width:number,height:number}} bounds
 */
export function sanitizeVisible(input, bounds) {
  if (input === null || typeof input !== 'object') return null
  /** @type {Record<string, any>} */
  const out = {}
  for (const key of ['pig', 'bubble', 'menu', 'gift', 'hud', 'overlay']) {
    out[key] = input[key] === null || input[key] === undefined ? null : sanitizeRect(input[key], bounds)
  }
  return out
}

/** 页面 dpr 只在合理范围内当元数据用；否则返回 null，调用方走旧路径。 */
export function sanitizeDpr(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= DPR_MIN && value <= DPR_MAX
    ? value : null
}

/** 页面 CSS 视口必须是有界的正数；缺了它不能拿 getContentBounds() 的 DIP 当 CSS 尺寸。 */
export function sanitizeViewport(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const width = Number(value.width)
  const height = Number(value.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0 || width > VIEWPORT_MAX || height > VIEWPORT_MAX) return null
  return { width, height }
}

/**
 * 页面 → 主进程的整条消息。非对象/非数组一律不接受。
 * 有合法 CSS 视口时按它裁形状；没有时保持旧行为（按传入的窗口内容 bounds），
 * 输出也不多加字段，旧页面载荷逐字段不变。
 * @param {any} payload
 * @param {{width:number,height:number}} bounds
 */
export function sanitizeReport(payload, bounds) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const dpr = sanitizeDpr(payload.dpr)
  const viewport = sanitizeViewport(payload.viewport)
  const cssBounds = viewport ?? bounds
  /** @type {Record<string, any>} */
  const report = {
    shape: sanitizeShape(payload.shape, cssBounds),
    visible: sanitizeVisible(payload.visible, cssBounds),
    interacting: payload.interacting === true,
  }
  if (dpr !== null) report.dpr = dpr
  if (viewport !== null) report.viewport = viewport
  return report
}

/** 形状去重键。顺序由页面稳定生成，不做排序以免掩盖更新逻辑的错误。 */
export function shapeKey(rects) {
  return Array.isArray(rects) ? JSON.stringify(rects) : ''
}

/**
 * Windows/macOS 鼠标命中：光标（屏幕 DIP）是否落在窗口内某个矩形里。
 * @param {{x:number,y:number}} cursor
 * @param {{x:number,y:number,width:number,height:number}} bounds
 * @param {{x:number,y:number,width:number,height:number}[]} rects
 */
export function pointerHitsShape(cursor, bounds, rects) {
  const x = cursor.x - bounds.x
  const y = cursor.y - bounds.y
  return rects.some(rect => rect.width > 0 && rect.height > 0
    && x >= rect.x && x < rect.x + rect.width
    && y >= rect.y && y < rect.y + rect.height)
}

/** 扩展 key 只允许和现有 piggy:ext:open 一样的字符集。 */
export function validExtKey(value) {
  return typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value)
}

/** 存档名只接受现有 lib/save-export.js 的命名，避免调用方指定路径。 */
export function validArchiveName(value) {
  return typeof value === 'string' && /^piggy-save-\d{8}-\d{4}\.zip$/.test(value)
}

/** 字节只接受有限大小的 Uint8Array。 */
export function validArchiveBytes(value) {
  return value instanceof Uint8Array && value.byteLength > 0 && value.byteLength <= MAX_BYTES
}
