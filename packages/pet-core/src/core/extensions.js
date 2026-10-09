// @ts-check
/**
 * 扩展开关（存在存档里：state.extensions = { pomodoro: true, fishing: false, … }）。
 * 老存档补成全部打开；认不出的 key 原样保留（以后降级再升级不丢开关）。不升存档版本。
 */
import { EXTENSIONS, extensionByKey } from '../data/extensions.js'
import { BOX_TICKET, itemByKey } from '../data.js'
import { abandonPomodoro, emptyPomodoro, ensurePomodoro } from './pomodoro.js'
import { emptyFishing, ensureFishing, keepFish } from './fishing.js'
import { ensureDex } from './dex.js'
import { callOffActivity } from './activity.js'
import { resetExtensionEventBaselines } from './extension-events.js'
import { cashOutWallet } from './wallets.js'

/** @param {any} state */
export function ensureExtensions(state) {
  const raw = state.extensions !== null && typeof state.extensions === 'object' && !Array.isArray(state.extensions) ? state.extensions : {}
  const next = { ...raw }
  for (const extension of EXTENSIONS) {
    if (typeof next[extension.key] !== 'boolean') next[extension.key] = true
  }
  state.extensions = next
  // 删掉的内置扩展、下载来的扩展的数据（v0.30，见 docs/design/extension-download.md）。
  if (!Array.isArray(state.extensionsRemoved)) state.extensionsRemoved = []
  state.extensionsRemoved = state.extensionsRemoved.filter(key => typeof key === 'string')
  if (state.extData === null || typeof state.extData !== 'object' || Array.isArray(state.extData)) state.extData = {}
  return next
}

/** 这个扩展装没装：内置的看有没有被删，下载的看有没有数据（宿主装的时候建好）。 @param {any} state @param {string} key */
export function extensionInstalled(state, key) {
  if (state === null || state === undefined) return true
  if (extensionByKey(key) !== null) return !(state.extensionsRemoved ?? []).includes(key)
  return state.extData?.[key] !== undefined
}

/** @param {any} state @param {string} key */
export function extensionOn(state, key) {
  if (state === null || state === undefined) return true
  if (!extensionInstalled(state, key)) return false
  const value = state.extensions?.[key]
  if (typeof value === 'boolean') return value
  return true
}

/**
 * 打开或关闭一个扩展。关闭时把进行中的收尾（用户 2026-10-05 定的：进行中也能关）：
 *   番茄钟专注中 → 放弃这一个（不给奖励，恢复免打扰设置）；
 *   猪在外面自动钓鱼 → 召回并退还鱼饵；已经钓上来还没收的鱼 → 收进鱼篓；检定中 → 算失败。
 * @param {any} state @param {string} key @param {boolean} on @param {number} nowMs
 */
export function setExtension(state, key, on, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  const extension = extensionByKey(key)
  const flags = ensureExtensions(state)
  if (extension === null && state.extData[key] === undefined) return { ok: false, reason: 'unknown-extension' }
  if (!extensionInstalled(state, key)) return { ok: false, reason: 'not-installed' }
  const wanted = on === true
  if (flags[key] === wanted) return { ok: true, key, on: wanted, changed: false }
  const wrapped = []
  if (!wanted && key === 'pomodoro' && ensurePomodoro(state).startedAt !== null) {
    const result = abandonPomodoro(state, nowMs)
    if (result.ok) wrapped.push(result.abandoned ? 'pomodoro-abandoned' : 'pomodoro-finished')
  }
  if (!wanted && key === 'fishing') {
    const fishing = ensureFishing(state)
    if (fishing.pending !== null && fishing.pending.phase === 'caught' && keepFish(state, nowMs).ok) wrapped.push('fish-kept')
    fishing.pending = null
    if (state.activity?.kind === 'fishing') {
      const result = callOffActivity(state, nowMs)
      if (result.ok) wrapped.push('fishing-recalled')
    }
  }
  flags[key] = wanted
  return { ok: true, key, on: wanted, changed: true, wrapped }
}

/**
 * 删除一个扩展：先按「关掉」收尾，再清掉它的存档数据（用户 2026-10-05：删除 = 卸载并清数据）。
 * 下载来的扩展这里只清 `extData`，文件由宿主删。
 * @param {any} state @param {string} key @param {number} nowMs
 */
export function removeExtension(state, key, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  ensureExtensions(state)
  if (!extensionInstalled(state, key)) return { ok: false, reason: 'not-installed' }
  const builtin = extensionByKey(key)
  if (builtin === null && state.extData[key] === undefined) return { ok: false, reason: 'unknown-extension' }
  const closed = setExtension(state, key, false, nowMs)
  if (key === 'pomodoro') state.pomodoro = emptyPomodoro()
  if (key === 'fishing') {
    state.fishing = emptyFishing()
    ensureDex(state, nowMs).fish = {}
    const inventory = { ...(state.inventory ?? {}) }
    for (const itemKey of Object.keys(inventory)) if (itemByKey(itemKey)?.kind === 'bait') delete inventory[itemKey]
    state.inventory = inventory
  }
  if (builtin !== null) state.extensionsRemoved = [...state.extensionsRemoved, key]
  else {
    delete state.extData[key]
    // 它的币按存着的汇率全部换成金币（规则 1：删扩展不让玩家亏）。
    cashOutWallet(state, key, nowMs)
  }
  // 盲盒券是盲盒的东西：删盲盒时一起收走。
  if (key === BOX_TICKET.extension && state.inventory?.[BOX_TICKET.key] !== undefined) {
    const inventory = { ...state.inventory }
    delete inventory[BOX_TICKET.key]
    state.inventory = inventory
  }
  delete state.extensions[key]
  return { ok: true, key, removed: true, wrapped: closed.ok ? closed.wrapped ?? [] : [] }
}

/**
 * 安装一个扩展：内置的直接装回（从零开始）；下载的由宿主放好文件后调用，`initial` 是它的初始数据。
 * @param {any} state @param {string} key @param {object} [initial]
 */
export function installExtension(state, key, initial) {
  if (state === null) return { ok: false, reason: 'absent' }
  ensureExtensions(state)
  if (extensionByKey(key) !== null) {
    state.extensionsRemoved = state.extensionsRemoved.filter(entry => entry !== key)
  } else {
    if (typeof key !== 'string' || !/^[a-z0-9-]{2,24}$/.test(key)) return { ok: false, reason: 'unknown-extension' }
    if (state.extData[key] === undefined) {
      resetExtensionEventBaselines(state, key)
      state.extData[key] = initial !== null && typeof initial === 'object' ? initial : {}
    }
  }
  state.extensions[key] = true
  return { ok: true, key, installed: true }
}

/**
 * 扩展中心要显示的：每个扩展的名称、说明、开没开。
 * @param {any} state
 */
export function extensionsView(state) {
  return EXTENSIONS.map(extension => ({
    key: extension.key,
    label: extension.label,
    emoji: extension.emoji,
    description: extension.description,
    on: extensionOn(state, extension.key),
    installed: extensionInstalled(state, extension.key),
    builtin: true,
    apps: [...extension.apps],
    dexSections: [...extension.dexSections],
    shopKinds: [...extension.shopKinds],
  }))
}

/** 关掉的扩展占用的商品种类 / 图鉴分区 / App：快照和客户端按它们过滤。 @param {any} state */
export function disabledParts(state) {
  const parts = { apps: new Set(), dexSections: new Set(), shopKinds: new Set() }
  for (const extension of EXTENSIONS) {
    if (extensionOn(state, extension.key)) continue
    for (const app of extension.apps) parts.apps.add(app)
    for (const section of extension.dexSections) parts.dexSections.add(section)
    for (const kind of extension.shopKinds) parts.shopKinds.add(kind)
  }
  return parts
}
