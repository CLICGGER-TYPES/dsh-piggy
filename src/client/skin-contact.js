// @ts-check
/**
 * 摸摸小手的接触点：导入皮肤和特殊外观可以声明、也可以在本机校准「手落在立绘的哪里」。
 *
 * 坐标系：立绘方框（`.dp-pig-img` 的方形布局盒，0,0 左上、1,1 右下、y 向下），
 * 和 art-framing 的透明边界（ART_BOUNDS）以及 pet-snap 量出来的墨迹边界是同一套坐标。
 * 取景（--art-zoom / --art-x / --art-y）由 framedSkinPoint 换算，所以「小猪大小」缩放、
 * 皮肤自己的取景缩放都不会把落点甩掉；镜像交给 CSS（.dp-pet-snap 与 .dp-pig-img 一起翻），
 * 这里始终算不镜像的布局坐标。换算本身复用 character-geometry 的 unit rect，不另存一份取景数学。
 *
 * 普通皮肤（默认猪、没校准过的内置皮肤、没有 contact 的旧皮肤包）返回 null：
 * pet-snap 继续用原来的自动估计，手的位置和以前逐像素一致。
 * 本机校准只写 localStorage，不进养成存档、不改别人存档、不花钱。
 *
 * 优先级：本机校准 > 本机「恢复自动」标记 > 皮肤包声明 > 自动估计。
 * 「恢复自动」会留一个 auto 标记，之后每次轮询/载入同步存档都不能把包声明再装回来；
 * 用户手动校准（setSkinContactOverride）或重新导入皮肤包（setDeclaredSkinContact）都会清掉这个标记。
 *
 * 皮肤包的 contact 由服务端快照导出，但这份声明只在「导入时」和「每次渲染同步快照」时落到本机，
 * 所以换设备/载入同步存档也能拿回声明（syncDeclaredSkinContacts）。
 *
 * 睡姿（打盹/困了）本来就不播摸摸手（见 pet-snap-geometry.js canPlayPetSnap），
 * 所以接触点只描述站立立绘；换成睡姿图时不会拿它去套。
 *
 * 换肤页的「试试手 / 按住拖动」是一条**纯视觉预览**通道（PET_PREVIEW_KEY）：
 * 只写一个本机 preference/event 键，另一个窗口（桌面版猪窗口）靠 storage 事件让本窗口的 pet-snap
 * 真的按一下/松手；不经过游戏 action、不触发 pet/touch/奖励、不写养成事件、不持久化手的状态。
 * 同一窗口收不到自己的 storage 事件，所以发送方在本地补发一次；两端都按 art 匹配当前皮肤。
 *
 * @module dsh-piggy/client/skin-contact
 */
import { normalizeSkinContact } from '../../packages/pet-core/src/core/skins.js'
import { artPointToLayout, layoutPointToArt } from './character-geometry.js'
import { readStore, writeStore } from './storage.js'

export { normalizeSkinContact }

/** 本机皮肤接触点：{ overrides: 本机校准, declared: 皮肤包声明, auto: 用户明确选了「恢复自动」}。 */
export const SKIN_CONTACT_KEY = 'dsh-piggy:skin-contacts'
/** 摸摸手预览事件（纯视觉，另一个窗口靠它开始/结束一次预览）。 */
export const PET_PREVIEW_KEY = 'dsh-piggy:pet-snap-preview'
/** 预览事件的有效期：页面卡住/刷新后迟到的通知不再放一次手。 */
export const PET_PREVIEW_TTL_MS = 3000
/** 按住预览的租约：超过这么久没有续约就自己松手（pointermove 续约）。 */
export const PET_PREVIEW_LEASE_MS = 4000
/** 续约节流：拖动时最多这么久写一次 localStorage。 */
export const PET_PREVIEW_RENEW_MS = 800
/** 手层标定：参考小猪的可见墨迹高度是 78.90625 个图内像素（见 pet-snap.js / pet-snap-geometry.js）。 */
export const PET_CONTACT_HEIGHT = 78.90625
/** 皮肤 art 名（custom-xxx / career-chef / skin-mint …），不带上场景后缀。 */
const ART_KEY = /^[a-z0-9-]{1,64}$/
/** 预览动作：press 按下 / release 播完这一轮 / cancel 立刻收掉。 */
const PREVIEW_ACTIONS = new Set(['press', 'release', 'cancel'])
/** 立绘方框是单位正方形：取景只用 zoom 和 x/y 百分比偏移。 */
const UNIT_BOX = Object.freeze({ x: 0, y: 0, width: 1, height: 1 })

const listeners = new Set()
const previewListeners = new Set()
let bridgedWindow = null

function cleanMap(raw) {
  /** @type {Record<string, {x: number, y: number}>} */
  const out = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [art, value] of Object.entries(raw)) {
    const contact = normalizeSkinContact(value)
    if (contact !== null && ART_KEY.test(art)) out[art] = contact
  }
  return out
}

/** 「恢复自动」标记：只认 true，别的值一律当作没有。 */
function cleanAuto(raw) {
  /** @type {Record<string, true>} */
  const out = {}
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [art, value] of Object.entries(raw)) {
    if (value === true && ART_KEY.test(art)) out[art] = true
  }
  return out
}

/** 本机存的那份；坏 JSON、隐私模式、外来乱七八糟的值都当成「没校准」。旧格式（没有 auto）照样读。 */
export function readSkinContacts() {
  ensureStorageBridge()
  const raw = readStore(SKIN_CONTACT_KEY)
  let parsed = null
  try { parsed = JSON.parse(raw ?? '') } catch { parsed = null }
  const source = parsed !== null && typeof parsed === 'object' ? parsed : {}
  return {
    overrides: cleanMap(/** @type {any} */ (source).overrides),
    declared: cleanMap(/** @type {any} */ (source).declared),
    auto: cleanAuto(/** @type {any} */ (source).auto),
  }
}

function writeSkinContacts(state) {
  writeStore(SKIN_CONTACT_KEY, JSON.stringify(state))
  listeners.forEach(fn => fn())
}

/** 本机校准优先于皮肤包声明；都没有、或用户选了「恢复自动」就是 null（自动估计）。 */
export function effectiveSkinContact(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return null
  const state = readSkinContacts()
  if (state.overrides[art] !== undefined) return state.overrides[art]
  if (state.auto[art] === true) return null
  return state.declared[art] ?? null
}

/** 'local' 本机校准 / 'pack' 皮肤包声明 / 'auto' 自动估计 —— 皮肤页用来说清现在按哪个算。 */
export function skinContactSource(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return 'auto'
  const state = readSkinContacts()
  if (state.overrides[art] !== undefined) return 'local'
  if (state.auto[art] === true) return 'auto'
  if (state.declared[art] !== undefined) return 'pack'
  return 'auto'
}

/** 写下本机校准；传 null 就清掉这一项（回到皮肤包声明/自动估计）。 */
export function setSkinContactOverride(art, contact) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return false
  const state = readSkinContacts()
  // 传 null 是「清掉本机校准」；不合法就原样不动，别把已有的校准弄丢。
  if (contact === null) delete state.overrides[art]
  else {
    const value = normalizeSkinContact(contact)
    if (value === null) return false
    state.overrides[art] = value
    // 手动校准盖过「恢复自动」：从此按本机校准算。
    delete state.auto[art]
  }
  writeSkinContacts(state)
  return true
}

/** 导入成功后把皮肤包声明的接触点记在本机（跨设备/重装后会跟着重新导入恢复）。 */
export function setDeclaredSkinContact(art, contact) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return false
  const value = normalizeSkinContact(contact)
  if (value === null) return false
  const state = readSkinContacts()
  const current = state.declared[art]
  if (current !== undefined && current.x === value.x && current.y === value.y && state.auto[art] !== true) return true
  state.declared[art] = value
  // 重新导入皮肤包是用户的显式动作：包里的声明重新生效。
  delete state.auto[art]
  writeSkinContacts(state)
  return true
}

/** 「恢复自动」：本机校准和包内声明一起清掉，并留一个 auto 标记挡住之后的快照同步。 */
export function clearSkinContact(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return false
  const state = readSkinContacts()
  delete state.overrides[art]
  delete state.declared[art]
  state.auto[art] = true
  writeSkinContacts(state)
  return true
}

/**
 * 快照 → 本机声明缓存：每次渲染把服务端 skinView 导出的 contact 落到本机，
 * 换设备/载入同步存档也能拿回皮肤包的声明（不再只在导入那一刻记一次）。
 *
 * 只认严格有效的 contact；用户按过「恢复自动」的皮肤不再被包声明装回来。
 * 明确声明了 null 的条目（新宿主的旧皮肤包/内置皮肤）会清掉过期声明；
 * 宿主根本没发 contact 字段（旧宿主）时一律不动本机已有的值。
 * @param {{entries?: any[]} | null | undefined} skins 归一化后的 view.skins
 */
export function syncDeclaredSkinContacts(skins) {
  const entries = Array.isArray(skins?.entries) ? skins.entries : []
  const state = readSkinContacts()
  let changed = false
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue
    const art = entry.art
    if (typeof art !== 'string' || !ART_KEY.test(art)) continue
    const contact = normalizeSkinContact(entry.contact)
    if (contact !== null) {
      if (state.auto[art] === true) continue
      const current = state.declared[art]
      if (current !== undefined && current.x === contact.x && current.y === contact.y) continue
      state.declared[art] = contact
      changed = true
    } else if (state.auto[art] !== true && state.declared[art] !== undefined && entry.contactStated === true) {
      delete state.declared[art]
      changed = true
    }
  }
  if (changed) writeSkinContacts(state)
  return changed
}

/** 接触点变了（本窗口改动，或另一个窗口写了 localStorage）：让正在播的手重新落位。 */
export function onSkinContactChange(fn) {
  ensureStorageBridge()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- 纯视觉预览：换肤页按一下/按住 → 任一本窗口的 pet-snap 真的按一下 ----------

/** 另一个窗口（或本窗口补发）的预览通知；返回取消订阅。 */
export function onPetSnapPreview(fn) {
  ensureStorageBridge()
  previewListeners.add(fn)
  return () => previewListeners.delete(fn)
}

/** 解析一条预览事件：动作、art、时间戳都要严格合法，过期/未来太远的直接拒收。 */
function parsePreview(raw) {
  if (typeof raw !== 'string' || raw === '') return null
  let value = null
  try { value = JSON.parse(raw) } catch { return null }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const { id, art, action, at } = /** @type {{id?: unknown, art?: unknown, action?: unknown, at?: unknown}} */ (value)
  if (typeof art !== 'string' || !ART_KEY.test(art)) return null
  if (typeof action !== 'string' || !PREVIEW_ACTIONS.has(action)) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  if (Math.abs(Date.now() - at) > PET_PREVIEW_TTL_MS) return null
  return { id: typeof id === 'string' ? id : '', art, action: /** @type {'press'|'release'|'cancel'} */ (action), at }
}

function dispatchPreview(payload) {
  if (payload === null) return false
  for (const fn of previewListeners) {
    try { fn(payload) } catch (error) { console.warn('摸摸手预览通知处理失败', error) }
  }
  return true
}

let previewSeq = 0
let previewOwner = null
let previewSentAt = 0

function sendPreview(art, action) {
  const payload = { id: Date.now().toString(36) + '-' + (++previewSeq), art, action, at: Date.now() }
  writeStore(PET_PREVIEW_KEY, JSON.stringify(payload))
  // 同一窗口收不到自己的 storage 事件（DSH 单窗口就是面板和猪在同一个窗口）：本地补发一次。
  // 远端窗口只会收到 storage 那一次，所以不会「本窗口 + 远端」重复播。
  dispatchPreview(payload)
  return payload.id
}

/** 开始一次预览（按住）：同一 art 重复调用是续约，不会重按。 */
export function startSkinContactPreview(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return false
  if (previewOwner !== null && previewOwner !== art) cancelSkinContactPreview()
  previewOwner = art
  previewSentAt = Date.now()
  sendPreview(art, 'press')
  return true
}

/** 拖动时的续约：节流写，避免 pointermove 每像素一次 localStorage。 */
export function renewSkinContactPreview() {
  if (previewOwner === null) return false
  const now = Date.now()
  if (now - previewSentAt < PET_PREVIEW_RENEW_MS) return false
  previewSentAt = now
  sendPreview(previewOwner, 'press')
  return true
}

/** 松手：手里的这一轮播完（最少一轮，5×60ms 语义不变）。 */
export function endSkinContactPreview() { return finishPreview('release') }

/** 立刻收掉（失焦、页面隐藏、面板卸载、切页签）。 */
export function cancelSkinContactPreview() { return finishPreview('cancel') }

function finishPreview(action) {
  if (previewOwner === null) return false
  const art = previewOwner
  previewOwner = null
  previewSentAt = 0
  sendPreview(art, action)
  return true
}

/** 页面被藏起来/窗口失焦时，手上的预览 lease 也要放掉，别让手一直按着。 */
function cancelOwnPreview() { cancelSkinContactPreview() }

function onStorage(event) {
  const key = /** @type {StorageEvent | null} */ (event)?.key
  if (key === SKIN_CONTACT_KEY || key === null || key === undefined) listeners.forEach(fn => fn())
  if (key === PET_PREVIEW_KEY) dispatchPreview(parsePreview(/** @type {any} */ (event)?.newValue))
}

/**
 * 在真实 window 上挂 storage/失焦监听（每个 window 只挂一次）。
 * 由读偏好和注册回调时惰性挂上：Node 测试里换一个假 window 也能走同一条 storage 路径。
 */
function ensureStorageBridge() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  if (bridgedWindow === window) return
  bridgedWindow = window
  window.addEventListener('storage', onStorage)
  window.addEventListener('blur', cancelOwnPreview)
  if (typeof document !== 'undefined' && typeof document?.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function () { if (document.hidden) cancelOwnPreview() })
  }
}

/** 立绘方框里的一点 → 取景后的布局坐标（复用 character-geometry 的 unit rect，取景数学只留一份）。 */
export function framedSkinPoint(point, zoom = 1, x = 0, y = 0) {
  return artPointToLayout(UNIT_BOX, point, { zoom, shiftX: x, shiftY: y })
}

/** 取景后的布局坐标 → 立绘方框里的点：皮肤页把指针位置换算回 normalized 坐标。 */
export function unframedSkinPoint(point, zoom = 1, x = 0, y = 0) {
  return layoutPointToArt(UNIT_BOX, point, { zoom, shiftX: x, shiftY: y })
}

/** 把 normalized 坐标夹回 [0,1]（拖动方框时用），保留 5 位小数。 */
export function clampSkinContact(point) {
  const round = value => Math.round(Math.min(1, Math.max(0, value)) * 100000) / 100000
  return { x: round(point.x), y: round(point.y) }
}

/** 自动估计的接触基准：可见墨迹的水平中心 + 墨迹顶线（pet-snap 手层就是按这个标定的）。 */
export function autoSkinContact(bounds) {
  return { x: (bounds.left + bounds.right) / 2, y: bounds.top }
}

/** 手层缩放系数：可见墨迹高度换算成参考高度（手比猪大小时用它）。 */
export function handScaleRatio(bounds) {
  return (bounds.bottom - bounds.top) / PET_CONTACT_HEIGHT
}

/**
 * 手层要额外平移多少（布局单位，y 向下）。
 * target 为 null（普通皮肤/没校准）时返回 0，和接入前的落点逐像素一致。
 */
export function skinContactShift(bounds, target) {
  if (target === null || target === undefined) return { dx: 0, dy: 0 }
  const auto = autoSkinContact(bounds)
  return { dx: target.x - auto.x, dy: target.y - auto.y }
}

ensureStorageBridge()
