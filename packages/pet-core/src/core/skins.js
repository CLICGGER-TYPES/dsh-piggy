// @ts-check

import { REQUIRED_SKIN_SCENES, SKINS, skinByKey } from '../data.js'
import { ensureDex, recordDex } from './dex.js'

const KEY = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/

/**
 * 导入皮肤可选的「摸摸手接触点」：立绘方框里的 normalized 坐标（0,0 左上，1,1 右下，y 向下）。
 *
 * 只接受两个都在 [0,1] 里的有限数：NaN/Infinity/字符串/超出范围都当作「没有声明」，
 * 让小手回到自动估计，绝不让一个坏字段把皮肤本身弄丢（旧包没有这个字段，完全兼容）。
 * 保留 4 位小数，存档与快照里不出现 0.30000000000000004 这种值。
 * @param {unknown} raw
 * @returns {{x: number, y: number} | null}
 */
export function normalizeSkinContact(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { x, y } = /** @type {{x?: unknown, y?: unknown}} */ (raw)
  if (typeof x !== 'number' || typeof y !== 'number') return null
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  const round = value => Math.round(value * 10000) / 10000
  return { x: round(x), y: round(y) }
}

function clean(raw) {
  if (raw === null || typeof raw !== 'object' || !KEY.test(String(raw.key ?? ''))) return null
  const scenes = [...new Set(Array.isArray(raw.scenes) ? raw.scenes.filter(x => typeof x === 'string') : [])]
  if (!REQUIRED_SKIN_SCENES.every(scene => scenes.includes(scene))) return null
  const key = String(raw.key)
  const contact = normalizeSkinContact(raw.contact)
  return {
    key, label: String(raw.label ?? key).slice(0, 30), author: String(raw.author ?? '玩家').slice(0, 30),
    description: String(raw.description ?? '').slice(0, 100), emoji: String(raw.emoji ?? '🎨').slice(0, 4),
    art: `custom-${key}`, scenes, custom: true,
    // 没有声明就不写这个字段：老存档读进来还是老样子，不需要提存档版本。
    ...(contact === null ? {} : { contact }),
  }
}

export function ensureSkins(state) {
  if (state === null) return state
  state.customSkins = Array.isArray(state.customSkins) ? state.customSkins.map(clean).filter(Boolean) : []
  const known = state.customSkins.some(skin => skin.key === state.skin) || skinByKey(state.skin) !== null
  state.skin = known ? state.skin : 'default'
  return state
}

export function allSkins(state) {
  ensureSkins(state)
  return [
    { key: 'default', label: '默认小猪', emoji: '🐷', art: 'piglet', author: 'dsh-piggy', description: '熟悉的小猪。', scenes: ['idle'], custom: false },
    ...SKINS,
    ...(state?.customSkins ?? []),
  ]
}

export function skinView(state) {
  if (state === null) return { current: 'default', entries: [] }
  ensureSkins(state)
  return { current: state.skin, entries: allSkins(state).map(skin => ({
    ...skin, current: skin.key === state.skin,
    unlocked: skinUnlocked(state, skin),
    // 快照里统一给这个字段（内置皮肤/旧包是 null），面板侧按它做可选校准。
    contact: normalizeSkinContact(skin.contact),
  })) }
}

function skinUnlocked(state, skin) {
  return !('unlockJob' in skin) || state.dex?.skins?.[skin.key] !== undefined
}

/** Completing the corresponding real job unlocks its look once, permanently. */
export function unlockCareerLook(state, jobKey, nowMs) {
  const skin = SKINS.find(entry => 'unlockJob' in entry && entry.unlockJob === jobKey)
  if (skin === undefined) return null
  ensureDex(state, nowMs)
  if (state.dex.skins[skin.key] !== undefined) return null
  recordDex(state, 'skins', skin.key, nowMs)
  return skin
}

export function selectSkin(state, key, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  ensureSkins(state)
  const skin = allSkins(state).find(entry => entry.key === key)
  if (!skin) return { ok: false, reason: 'unknown' }
  if (!skinUnlocked(state, skin)) return { ok: false, reason: 'locked', job: skin.unlockJob }
  // Switching an already owned look is not another acquisition.
  if (state.dex?.skins?.[skin.key] === undefined) recordDex(state, 'skins', skin.key, nowMs)
  state.skin = skin.key
  return { ok: true, skin: skin.key }
}

export function registerCustomSkin(state, raw, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  ensureSkins(state)
  const skin = clean(raw)
  if (!skin) return { ok: false, reason: 'invalid' }
  if (skin.key === 'default' || skinByKey(skin.key) !== null) return { ok: false, reason: 'reserved' }
  const at = state.customSkins.findIndex(entry => entry.key === skin.key)
  if (at < 0) state.customSkins.push(skin)
  else state.customSkins[at] = skin
  recordDex(state, 'skins', skin.key, nowMs)
  state.skin = skin.key
  return { ok: true, skin: skin.key }
}

export function skinStageView(state, stage) {
  if (state === null) return stage
  ensureSkins(state)
  const skin = allSkins(state).find(entry => entry.key === state.skin)
  if (!skin || skin.key === 'default') return stage
  return { ...stage, art: skin.art, artScenes: [...skin.scenes], actionArt: true }
}
