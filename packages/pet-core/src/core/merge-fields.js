// @ts-check
/**
 * 合并里的组合字段：映射求和/取大、疾病、冷却、对话、体重、扩展开关。
 *
 * 从 merge.js 拆出来，保持单文件 400 行以内（见 docs/CONVENTIONS.md）。
 *
 * @module dsh-piggy/core/merge-fields
 */

import { ILLNESS_CHAINS, STAGE_HEALTH } from '../data.js'
import { aliveHatched, isObject, maxNum, num, sumCap, todaySide, whole } from './merge-rules.js'

/** 按 key 逐项相加，封顶 MAX_SAFE_INTEGER。 */
export function sumMap(T, S) {
  const out = {}
  for (const [key, value] of Object.entries({ ...(isObject(T) ? T : {}), ...(isObject(S) ? S : {}) })) {
    out[key] = sumCap(T?.[key], S?.[key])
  }
  return out
}

/** 按 key 逐项取大。 */
export function maxMap(T, S) {
  const out = {}
  for (const [key, value] of Object.entries({ ...(isObject(T) ? T : {}), ...(isObject(S) ? S : {}) })) {
    out[key] = maxNum(T?.[key], S?.[key])
  }
  return out
}

export function mergeIllness(T, S) {
  const bothAlive = aliveHatched(T) && aliveHatched(S)
  if (!aliveHatched(T) && !aliveHatched(S)) return null
  if (!bothAlive) {
    const live = aliveHatched(T) ? T : S
    return live.illness === undefined ? null : live.illness
  }
  if (T.illness === null || T.illness === undefined || S.illness === null || S.illness === undefined) return null
  const a = T.illness, b = S.illness
  let pick = a
  if (b.stage < a.stage) pick = b
  else if (b.stage === a.stage && num(b.progressMs) < num(a.progressMs)) pick = b
  return { ...pick }
}

export function capForIllness(health, illness) {
  if (illness === null || illness === undefined) return health
  const chain = ILLNESS_CHAINS[illness.chain]
  if (chain === undefined) return health
  const stageHealth = STAGE_HEALTH[Math.max(0, Math.min(STAGE_HEALTH.length - 1, illness.stage - 1))]
  return Math.min(health, stageHealth)
}

export function mergeCooldowns(T, S, nowMs, live) {
  if (live !== null) return { ...(isObject(live.cooldowns) ? live.cooldowns : {}) }
  const out = {}
  const keys = new Set([...Object.keys(isObject(T.cooldowns) ? T.cooldowns : {}), ...Object.keys(isObject(S.cooldowns) ? S.cooldowns : {})])
  for (const key of keys) {
    const value = maxNum(T.cooldowns?.[key], S.cooldowns?.[key])
    if (value > nowMs) out[key] = value
  }
  return out
}

export function mergeTalk(T, S, nowMs, live) {
  if (live !== null) {
    const talk = isObject(live.dialogue?.talk) ? live.dialogue.talk : {}
    return { day: typeof talk.day === 'string' ? talk.day : '', said: [...(Array.isArray(talk.said) ? talk.said : [])], water: whole(talk.water), eyes: whole(talk.eyes) }
  }
  const t = isObject(T.dialogue?.talk) ? T.dialogue.talk : {}
  const s = isObject(S.dialogue?.talk) ? S.dialogue.talk : {}
  const side = todaySide(t.day, s.day, nowMs)
  const day = side === 'target' ? t.day : side === 'source' ? s.day : (typeof t.day === 'string' ? t.day : (typeof s.day === 'string' ? s.day : ''))
  const same = day !== '' && t.day === day && s.day === day
  const picks = same ? [t, s] : [t.day === day ? t : {}, s.day === day ? s : {}]
  const said = [...new Set(picks.flatMap(item => Array.isArray(item.said) ? item.said : []))]
  return { day, said, water: same ? Math.max(whole(t.water), whole(s.water)) : whole(picks[0].water), eyes: same ? Math.max(whole(t.eyes), whole(s.eyes)) : whole(picks[0].eyes) }
}

export function mergeDialogue(T, S, nowMs, live, base) {
  const baseDialogue = base === 'source' ? S.dialogue : T.dialogue
  const otherDialogue = base === 'source' ? T.dialogue : S.dialogue
  const lastByScene = { ...(isObject(baseDialogue?.lastByScene) ? baseDialogue.lastByScene : {}) }
  for (const [scene, value] of Object.entries(isObject(otherDialogue?.lastByScene) ? otherDialogue.lastByScene : {})) {
    if (lastByScene[scene] === undefined) lastByScene[scene] = value
  }
  return {
    ownerName: baseDialogue?.ownerName,
    lastByScene,
    open: null,
    quiet: baseDialogue?.quiet === true,
    greetedAt: maxNum(T.dialogue?.greetedAt, S.dialogue?.greetedAt),
    talk: mergeTalk(T, S, nowMs, live),
    petTimes: [],
    petAnnoyed: false,
  }
}

export function mergeBodyWeight(T, S, nowMs, base, live) {
  if (live !== null) {
    const record = isObject(live.bodyWeight) ? live.bodyWeight : {}
    return { ...record, playDay: typeof record.playDay === 'string' ? record.playDay : '', plays: whole(record.plays) }
  }
  const t = isObject(T.bodyWeight) ? T.bodyWeight : {}
  const s = isObject(S.bodyWeight) ? S.bodyWeight : {}
  const side = todaySide(t.playDay, s.playDay, nowMs)
  const day = side === 'target' ? t.playDay : side === 'source' ? s.playDay
    : (base === 'source' && typeof s.playDay === 'string' ? s.playDay : typeof t.playDay === 'string' ? t.playDay : '')
  const same = day !== '' && t.playDay === day && s.playDay === day
  const plays = same ? Math.min(10, sumCap(t.plays, s.plays))
    : day !== '' && t.playDay === day ? whole(t.plays)
      : day !== '' && s.playDay === day ? whole(s.plays) : 0
  const locked = ['normal', 'round', 'fat'].includes(t.lockedClass) ? t.lockedClass : s.lockedClass
  return { ...(['normal', 'round', 'fat'].includes(locked) ? { lockedClass: locked } : {}), playDay: day, plays }
}

export function mergeExtensions(T, S, options, warnings) {
  const tFlags = isObject(T.extensions) ? T.extensions : {}
  const sFlags = isObject(S.extensions) ? S.extensions : {}
  const tData = isObject(T.extData) ? T.extData : {}
  const sData = isObject(S.extData) ? S.extData : {}
  const installed = new Set(Array.isArray(options.targetInstalled) ? options.targetInstalled : [])
  const flags = { ...tFlags }
  const data = { ...tData }
  const hooks = isObject(options.hooks) ? options.hooks : {}
  const choices = isObject(options.choices?.extensions) ? options.choices.extensions : {}
  const conflicts = []
  for (const key of new Set([...Object.keys(tData), ...Object.keys(sData)])) {
    if (tData[key] === undefined) {
      data[key] = sData[key]
      flags[key] = true
      if (!installed.has(key)) warnings.push(`扩展 ${key} 的数据保留，但桌宠没装这个扩展，需要重新安装后才能使用`)
      continue
    }
    if (sData[key] === undefined) continue
    const hook = hooks[key]
    if (typeof hook === 'function') {
      try {
        const result = hook(tData[key], sData[key])
        if (isObject(result) && result.data !== undefined) {
          for (const warning of Array.isArray(result.warnings) ? result.warnings : []) warnings.push(String(warning))
          const unresolved = result.conflicts === undefined || result.conflicts === null ? []
            : Array.isArray(result.conflicts) ? result.conflicts : [result.conflicts]
          // 钩子报了没解决的冲突，就等于说明它自己没把握：不能拿它的 data 顶着用，
          // 按没有钩子时的规矩降级成二选一（两份数据都留着，默认桌宠这边）。
          if (unresolved.length === 0) {
            data[key] = result.data
            continue
          }
          const detail = unresolved
            .map(item => (typeof item === 'string' ? item : isObject(item) && typeof item.message === 'string' ? item.message : ''))
            .filter(text => text !== '')
          warnings.push(`扩展 ${key} 的合并钩子留下了 ${unresolved.length} 项未解决的冲突，改成二选一${detail.length > 0 ? `：${detail.join('；')}` : ''}`)
        }
      } catch (error) {
        warnings.push(`扩展 ${key} 的合并钩子失败，改成二选一：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    conflicts.push({ key: `ext:${key}`, label: `第三方·${key}`, options: ['target', 'source'], default: 'target' })
    if (choices[key] === 'source') data[key] = sData[key]
  }
  const removed = [...new Set([...(Array.isArray(T.extensionsRemoved) ? T.extensionsRemoved : []), ...(Array.isArray(S.extensionsRemoved) ? [] : [])])]
  return {
    extensions: flags,
    extData: data,
    extensionsRemoved: removed.filter(key => !(flags[key] === true && data[key] !== undefined)),
    conflicts,
  }
}

export function mergeRealWorkGrowth(T, S, nowMs, base, live) {
  if (live !== null) {
    const record = isObject(live.realWorkGrowth) ? live.realWorkGrowth : {}
    return { day: typeof record.day === 'string' ? record.day : '', amount: whole(record.amount) }
  }
  const t = isObject(T.realWorkGrowth) ? T.realWorkGrowth : {}
  const s = isObject(S.realWorkGrowth) ? S.realWorkGrowth : {}
  const side = todaySide(t.day, s.day, nowMs)
  const day = side === 'target' ? t.day : side === 'source' ? s.day : (base === 'source' && typeof s.day === 'string' ? s.day : typeof t.day === 'string' ? t.day : '')
  const amount = day !== '' && t.day === day && s.day === day ? Math.max(whole(t.amount), whole(s.amount))
    : day !== '' && t.day === day ? whole(t.amount) : day !== '' && s.day === day ? whole(s.amount) : 0
  return { day, amount }
}

