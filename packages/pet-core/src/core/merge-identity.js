// @ts-check
/**
 * 合并时的身份/偏好选择：名字、样子、性格、偏好和第三方扩展二选一。
 *
 * 用户选择在预览里给出，提交时再校验一遍；「改…」的值按现有 rename/profile
 * 规则清洗，合并中的编辑不消耗 profileEdits（见 #14 设计 4.5/6.2）。
 *
 * @module dsh-piggy/core/merge-identity
 */

import { CATCHPHRASE_MAX, MOTTO_MAX, OWNER_NAME_MAX, PERSONALITIES, SKINS, personalityByKey } from '../data.js'

/**
 * 合并时「自己改」名字的上限：跟当前居民卡一致（用户 10 月 21 日确认 5 字）。
 * 选已有的一边时原样保留，不截断旧档里的长名字。
 */
export const MERGE_NAME_MAX = 5
import { isObject } from './merge-rules.js'

export const CHOICE_KEYS = Object.freeze(['name', 'look', 'personality', 'preferences'])
const SIDES = new Set(['target', 'source'])
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const text = value => (typeof value === 'string' ? value : '')
const chars = value => [...text(value)]
const cleanName = value => chars(text(value).replace(/\s+/g, ' ').trim()).length
const trimTo = (value, max) => chars(text(value).trim()).slice(0, max).join('')
const validBirthday = value => isObject(value) && Number.isInteger(value.month) && value.month >= 1 && value.month <= 12
  && Number.isInteger(value.day) && value.day >= 1 && value.day <= MONTH_DAYS[value.month - 1]

/** 当前（或默认）选择：给预览和提交共用。 */
export function describeChoices(T, S, merged, { renames = {}, defaults = null } = {}) {
  const fallback = defaults ?? { name: 'target', look: 'target', personality: 'target', preferences: 'target' }
  const sideOf = key => (SIDES.has(key) ? key : 'target')
  const lookFor = side => {
    const state = side === 'source' ? S : T
    const skin = renames[state.skin] ?? state.skin
    return {
      form: state.form ?? null,
      skin: mergedSkinsHas(merged, skin) ? skin : 'default',
      worn: (Array.isArray(state.worn) ? state.worn : []).filter(item => (merged.dress ?? []).includes(item)),
    }
  }
  const personFor = side => {
    const state = side === 'source' ? S : T
    return {
      personality: state.personality,
      catchphrase: state.catchphrase,
      motto: state.motto,
      birth: state.birthday ?? null,
    }
  }
  const prefsFor = side => {
    const state = side === 'source' ? S : T
    return {
      ownerName: state.dialogue?.ownerName,
      quiet: state.dialogue?.quiet === true,
      isOfflineFeedEnabled: state.isOfflineFeedEnabled !== false,
      timeScale: Number.isFinite(state.timeScale) ? state.timeScale : 1,
      spot: state.fishing?.spot,
    }
  }
  const lookSide = sideOf(fallback.look), personSide = sideOf(fallback.personality), prefSide = sideOf(fallback.preferences)
  return [
    { key: 'name', label: '名字', options: ['target', 'source', 'custom'], default: sideOf(fallback.name),
      value: sideOf(fallback.name) === 'source' ? S.name : T.name },
    { key: 'look', label: '样子', options: ['target', 'source', 'custom'], default: lookSide, editable: ['form', 'skin', 'worn'], value: { side: lookSide, ...lookFor(lookSide) } },
    { key: 'personality', label: '性格', options: ['target', 'source', 'custom'], default: personSide, editable: ['personality', 'catchphrase', 'motto', 'birthday'], value: { side: personSide, ...personFor(personSide) } },
    { key: 'preferences', label: '偏好', options: ['target', 'source', 'custom'], default: prefSide, editable: ['ownerName', 'quiet', 'isOfflineFeedEnabled', 'timeScale', 'fishing.spot'], value: { side: prefSide, ...prefsFor(prefSide) } },
  ]
}

/** @type {Set<string>} */
const BUILT_IN_SKINS = new Set(SKINS.map(skin => skin.key))

/** 'default' 与内置皮肤（不是自定义包）都算合法；自定义皮肤看合并后的表。 */
export function mergedSkinsHas(merged, key) {
  if (typeof key !== 'string' || key === '') return false
  if (key === 'default' || BUILT_IN_SKINS.has(key)) return true
  return (Array.isArray(merged.customSkins) ? merged.customSkins : []).some(skin => skin.key === key)
}

/** 合并后的皮肤候选：默认 + 已解锁的内置皮肤 + 自定义皮肤（含改名后的 key）。 */
export function skinChoices(merged) {
  /** @type {Set<string>} */
  const unlocked = new Set(['default'])

  for (const key of Object.keys(isObject(merged?.dex?.skins) ? merged.dex.skins : {})) {
    if (BUILT_IN_SKINS.has(key)) unlocked.add(key)
  }
  const list = [{ key: 'default', label: '默认' }]
  for (const skin of SKINS) if (unlocked.has(skin.key)) list.push({ key: skin.key, label: skin.label })
  for (const skin of Array.isArray(merged?.customSkins) ? merged.customSkins : []) {
    if (typeof skin?.key !== 'string' || skin.key === '' || unlocked.has(skin.key)) continue
    unlocked.add(skin.key)
    list.push({ key: skin.key, label: typeof skin.label === 'string' && skin.label !== '' ? skin.label : skin.key })
  }
  return list
}

/** 性格候选（key + 中文 label），给「改…」下拉用，不让用户输技术 key。 */
export function personalityChoices() {
  return PERSONALITIES.map(item => ({ key: item.key, label: item.label }))
}

/** 规范化用户提交的选择；缺省按默认边。返回值里的 errors 为空才算通过。 */
export function normalizeChoices(raw, T, S, merged, renames = {}, defaults = {}) {
  const input = isObject(raw) ? raw : {}
  const errors = []
  const sideOf = value => (SIDES.has(value) ? value : null)
  const choiceOf = key => (isObject(input[key]) ? input[key] : {})
  const base = {
    name: sideOf(defaults.name) ?? 'target',
    look: sideOf(defaults.look) ?? 'target',
    personality: sideOf(defaults.personality) ?? 'target',
    preferences: sideOf(defaults.preferences) ?? 'target',
  }
  const out = {}
  const reject = (path, reason) => errors.push({ path, reason })

  const nameChoice = choiceOf('name')
  const nameSide = sideOf(nameChoice.side) ?? base.name
  if (nameChoice.side === 'custom') {
    const value = text(nameChoice.value)
    if (cleanName(value) < 1 || cleanName(value) > MERGE_NAME_MAX) reject('name.value', 'bad-name')
    out.name = { side: 'custom', value: chars(value.replace(/\s+/g, ' ').trim()).slice(0, MERGE_NAME_MAX).join('') }
  } else {
    out.name = { side: nameSide, value: (nameSide === 'source' ? S : T).name }
  }

  const lookChoice = choiceOf('look')
  const lookSide = lookChoice.side === 'custom' ? 'custom' : (sideOf(lookChoice.side) ?? base.look)
  const sideState = lookSide === 'source' ? S : T
  const defaultSkin = renames[sideState.skin] ?? sideState.skin
  const form = lookChoice.form === undefined ? sideState.form ?? null : lookChoice.form
  const skin = lookChoice.skin === undefined ? defaultSkin : lookChoice.skin
  const worn = lookChoice.worn === undefined ? (Array.isArray(sideState.worn) ? sideState.worn : []) : lookChoice.worn
  if (form !== null && !isObject(merged.dex?.forms?.[form])) reject('look.form', 'not-unlocked')
  if (!mergedSkinsHas(merged, skin)) reject('look.skin', 'unknown-skin')
  if (!Array.isArray(worn) || worn.some(item => typeof item !== 'string' || !(merged.dress ?? []).includes(item))) reject('look.worn', 'not-owned')
  const otherState = lookSide === 'source' ? T : S
  const sideWorn = Array.isArray(sideState.worn) ? sideState.worn.filter(item => (merged.dress ?? []).includes(item)) : []
  const otherWorn = Array.isArray(otherState.worn) ? otherState.worn.filter(item => (merged.dress ?? []).includes(item)) : []
  const fallbackWorn = !Array.isArray(worn) || worn.length === 0
    ? (lookSide === 'custom' ? [] : (sideWorn.length > 0 ? sideWorn : otherWorn))
    : worn
  out.look = { side: lookSide, form, skin, worn: [...new Set(fallbackWorn)] }

  const personChoice = choiceOf('personality')
  const personSide = personChoice.side === 'custom' ? 'custom' : (sideOf(personChoice.side) ?? base.personality)
  const source = personSide === 'source' ? S : T
  const personality = personChoice.personality === undefined ? source.personality : personChoice.personality
  const catchphrase = personChoice.catchphrase === undefined ? source.catchphrase : personChoice.catchphrase
  const motto = personChoice.motto === undefined ? source.motto : personChoice.motto
  const birthday = personChoice.birthday === undefined ? (source.birthday ?? null) : personChoice.birthday
  if (personalityByKey(personality) === null) reject('personality.personality', 'unknown')
  const phrase = trimTo(catchphrase, CATCHPHRASE_MAX)
  if (chars(text(catchphrase).trim()).length < 1 || chars(text(catchphrase).trim()).length > CATCHPHRASE_MAX) reject('personality.catchphrase', 'too-long')
  const sign = trimTo(motto, MOTTO_MAX)
  if (chars(text(motto).trim()).length > MOTTO_MAX || sign === '') reject('personality.motto', 'too-long')
  if (birthday !== null && !validBirthday(birthday)) reject('personality.birthday', 'bad-date')
  out.personality = { side: personSide, personality, catchphrase: phrase, motto: sign, birthday: birthday === null ? null : { month: birthday.month, day: birthday.day } }

  const prefChoice = choiceOf('preferences')
  const prefSide = prefChoice.side === 'custom' ? 'custom' : (sideOf(prefChoice.side) ?? base.preferences)
  const from = prefSide === 'source' ? S : T
  const ownerName = prefChoice.ownerName === undefined ? from.dialogue?.ownerName : prefChoice.ownerName
  const quiet = prefChoice.quiet === undefined ? from.dialogue?.quiet === true : prefChoice.quiet === true
  const offline = prefChoice.isOfflineFeedEnabled === undefined ? from.isOfflineFeedEnabled !== false : prefChoice.isOfflineFeedEnabled === true
  const scale = prefChoice.timeScale === undefined ? (Number.isFinite(from.timeScale) ? from.timeScale : 1) : prefChoice.timeScale
  const spot = prefChoice.spot === undefined ? from.fishing?.spot : prefChoice.spot
  if (typeof ownerName !== 'string' || chars(ownerName.trim()).length < 1 || chars(ownerName.trim()).length > OWNER_NAME_MAX) reject('preferences.ownerName', 'too-long')
  if (!Number.isFinite(scale) || scale <= 0 || scale > 365) reject('preferences.timeScale', 'bad-scale')
  if (!(Array.isArray(merged.fishing?.spots) ? merged.fishing.spots : []).includes(spot)) reject('preferences.spot', 'unknown-spot')
  out.preferences = { side: prefSide, ownerName: trimTo(ownerName, OWNER_NAME_MAX), quiet, isOfflineFeedEnabled: offline, timeScale: scale, spot }

  const extensions = {}
  if (isObject(input.extensions)) {
    for (const [key, value] of Object.entries(input.extensions)) {
      if (value !== 'target' && value !== 'source') reject(`extensions.${key}`, 'bad-side')
      else extensions[key] = value
    }
  }
  out.extensions = extensions
  return { choices: out, errors }
}

/** 把通过校验的选择写进合并结果。 */
export function applyChoices(merged, T, S, choices) {
  const pick = (side, t, s) => (side === 'source' ? s : t)
  merged.name = choices.name.side === 'custom' ? choices.name.value : pick(choices.name.side, T.name, S.name)
  merged.form = choices.look.form
  merged.skin = choices.look.skin
  merged.worn = [...choices.look.worn]
  merged.personality = choices.personality.personality
  merged.catchphrase = choices.personality.catchphrase
  merged.motto = choices.personality.motto
  if (choices.personality.birthday === null) delete merged.birthday
  else merged.birthday = { ...choices.personality.birthday }
  merged.dialogue.ownerName = choices.preferences.ownerName
  merged.dialogue.quiet = choices.preferences.quiet
  merged.isOfflineFeedEnabled = choices.preferences.isOfflineFeedEnabled
  merged.timeScale = choices.preferences.timeScale
  merged.fishing.spot = choices.preferences.spot
  return merged
}

/** 扩展冲突：两边都有数据、又没有官方钩子时逐个二选一。 */
export function describeExtensionConflicts(T, S, hooks) {
  const conflicts = []
  const t = isObject(T.extData) ? T.extData : {}
  const s = isObject(S.extData) ? S.extData : {}
  for (const key of new Set([...Object.keys(t), ...Object.keys(s)])) {
    if (t[key] === undefined || s[key] === undefined) continue
    if (isObject(hooks) && typeof hooks[key] === 'function') continue
    conflicts.push({ key: `ext:${key}`, label: `第三方·${key}`, options: ['target', 'source'], default: 'target' })
  }
  return conflicts
}

