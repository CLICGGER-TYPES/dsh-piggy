// @ts-check
/**
 * 状态迁移（重置/继承/领养/改名/复活）。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/state
 */

import { DEFAULT_TIME_SCALE, LINES, MAX, MAX_LEVEL, REVIVE_ITEM, SIGN_IN_CYCLE, formByKey, itemByKey, skinByKey, xpForLevel } from '../data.js'
import { dayKeyFor, lifeStageFor } from './clock.js'
import { MEMORY_LIMIT } from './constants.js'
import { announce, clamp, remember } from './effects.js'
import { layEgg } from './egg.js'
import { ensurePomodoro, settlePomodoro } from './pomodoro.js'
import { say } from './lines.js'
import { sanitizeIllness, sanitizeInventory, sanitizeTraits } from './migrate.js'
import { decay, die } from './settlement.js'
import { ensureDex, recordDex } from './dex.js'
import { ensureDaily } from './daily.js'
import { setBodyWeightClass } from './weight.js'
import { resetExtensionEventBaselines } from './extension-events.js'

/**
 * Wipe the pig and start from a fresh box, whatever state it was in.
 *
 * `adopt` only works once a pig has died, which meant there was no way to start
 * over with a living one short of deleting the save file by hand — and the
 * running host holds the state in memory, so editing the file does not even
 * work while it is up.
 */
export function reset(nowMs) {
  return layEgg(nowMs)
}

/**
 * What a new pig inherits from the old one.
 *
 * Schooling, traits and souvenirs carry over. Growth does not: since B2 the
 * level *is* the body, and a new piglet that inherited Lv40 would hatch fully
 * grown. Losing a pig is only ever an accident now (there is no old age), and
 * the revive item is the way to keep the one you have.
 */
export const INHERITED = ['traits', 'lessons', 'interests', 'souvenirs', 'dex', 'achievements']

export function inherit(oldState, fresh, nowMs) {
  if (oldState === null) return fresh
  for (const key of INHERITED) {
    if (oldState[key] !== undefined) fresh[key] = structuredCloneish(oldState[key])
  }
  resetExtensionEventBaselines(fresh)
  if (Array.isArray(oldState.memories)) fresh.memories = oldState.memories.slice(-MEMORY_LIMIT)
  remember(fresh, '🐖 新的小猪来了，本事和收藏都留下了', nowMs)
  return fresh
}

/** JSON round-trip; every inherited field is plain data. */
export function structuredCloneish(value) {
  try { return JSON.parse(JSON.stringify(value)) } catch (error) { return value }
}

/** Change how fast pig time runs. Only affects the future, never the past. */
export function setTimeScale(state, scale, nowMs) {
  if (state === null) return state
  const value = Number.isFinite(scale) && scale > 0 ? Math.min(365, scale) : DEFAULT_TIME_SCALE
  state.timeScale = value
  remember(state, `⏱ 时间倍率改成 ×${value}`, nowMs)
  return state
}

/** Put the pig's clock back to now, so its age counts real time again. */
export function ageFromNow(state, nowMs) {
  if (state === null) return state
  state.bornAt = nowMs
  state.ageMs = 0
  state.ageForced = false
  state.stage = lifeStageFor(state, nowMs).key
  state.lastSeenAt = nowMs
  remember(state, '🔧 年龄归零，从现在开始按真实时间算', nowMs)
  return state
}

/**
 * ---------------------------------------------------------------------------
 * Developer mode
 *
 * Applies an arbitrary patch to the pig so the panel can be driven into any
 * state without waiting days for it. Everything is clamped through the same
 * bounds the game uses, so dev mode can produce a *valid* state but never a
 * corrupt one — no negative coins, no health of 99, no dangling illness.
 * ---------------------------------------------------------------------------
 */

/** Numeric fields dev mode may set, with their legal range. */
export const DEV_NUMBERS = Object.freeze({
  satiety: [0, 100],
  happiness: [0, 100],
  cleanliness: [0, 100],
  health: [0, MAX.health],
  coins: [0, 1_000_000],
  xp: [0, 10_000_000],
  weightG: [400, 500_000],
})

export function applyDevPatch(state, patch, nowMs) {
  if (state === null || typeof patch !== 'object' || patch === null) return state
  const before = { dead: state.dead, hatched: state.hatched, stage: state.stage }
  ensureDex(state, nowMs)

  for (const [key, [lo, hi]] of Object.entries(DEV_NUMBERS)) {
    const value = patch[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      state[key] = clamp(Math.round(value), lo, hi)
    }
  }

  if (patch.traits !== null && typeof patch.traits === 'object') {
    state.traits = sanitizeTraits({ ...state.traits, ...patch.traits })
  }

  if (patch.illness === null) state.illness = null
  else if (typeof patch.illness === 'object' && patch.illness !== null) {
    state.illness = sanitizeIllness({ ...patch.illness, since: nowMs, progressMs: 0 }, nowMs)
  }

  if (patch.inventory !== null && typeof patch.inventory === 'object') {
    for (const [key, value] of Object.entries(patch.inventory)) {
      const beforeCount = state.inventory?.[key] ?? 0
      if (itemByKey(key) !== null && Number.isFinite(value) && value > beforeCount) recordDex(state, 'items', key, nowMs, Math.floor(value - beforeCount))
    }
    state.inventory = sanitizeInventory({ ...state.inventory, ...patch.inventory })
  }

  // Fast-forward: decay the pig as if `__advanceMs` had really passed. This is
  // the whole point of dev mode — the interesting states take days to reach.
  if (typeof patch.__advanceMs === 'number' && Number.isFinite(patch.__advanceMs) && patch.__advanceMs > 0) {
    const advance = Math.min(patch.__advanceMs, 60 * 86_400_000)
    state.lastSeenAt = nowMs - advance
    // Timed outings use wall-clock end timestamps too. Move the whole interval
    // back so the debug clock can actually finish work, study, trips and fishing.
    if (state.activity !== null) {
      state.activity.startedAt -= advance
      state.activity.endsAt -= advance
    }
    // 番茄钟是墙上时钟的计时器：快进也要把它一起往前挪，否则「+1 小时」永远等不到结算
    // （验收：调试快进一小时后结算并发奖）。挪完立刻结算，响应里就能看到奖励。
    const pomo = ensurePomodoro(state)
    if (pomo.startedAt !== null) pomo.startedAt -= advance
    if (pomo.restUntil !== null) pomo.restUntil -= advance
    decay(state, nowMs)
    settlePomodoro(state, nowMs)
  }

  // Level is what takes months to see now (B2): jump straight to one.
  if (typeof patch.level === 'number' && Number.isFinite(patch.level)) {
    state.xp = xpForLevel(clamp(Math.round(patch.level), 1, MAX_LEVEL))
  }

  // Age only counts days on the panel now; still jumpable for testing.
  if (typeof patch.weightClass === 'string') setBodyWeightClass(state, patch.weightClass)

  if (typeof patch.ageDays === 'number' && Number.isFinite(patch.ageDays)) {
    // Age is accumulated pig time, so both have to move or the stage will not.
    const days = Math.max(0, patch.ageDays)
    state.bornAt = nowMs - days * 86_400_000
    state.ageMs = days * 86_400_000
    // Mark it, so a forced age is never mistaken for the pig simply growing up.
    state.ageForced = true
  }

  // Health 0 is death, whether or not the panel also ticked "dead": leaving a
  // 0-health pig walking around showed a corpse with no grave or announcement.
  if (state.dead !== true && state.health <= 0) {
    die(state, nowMs, '被开发者按死了')
  }

  if (patch.dead === true) {
    die(state, nowMs, '被开发者按死了')
  } else if (patch.dead === false && state.dead === true) {
    revive(state, nowMs)
  }

  if (patch.hatched === true && state.hatched !== true) state.hatched = true
  if (patch.hatched === false) {
    state.hatched = false
    state.dead = false
    state.diedAt = null
    state.stage = 'box'
  }

  // 番茄钟（C2）：一键完成当前番茄（照常结算发奖）／把今天的完成数设成 8（测上限）。
  if (patch.pomodoro !== null && typeof patch.pomodoro === 'object') {
    const pomo = ensurePomodoro(state)
    if (patch.pomodoro.finish === true && pomo.startedAt !== null) {
      // 把开始时间往前挪到「刚好到点」，再走正常结算 —— 奖励和计数都照规矩来。
      pomo.startedAt = nowMs - pomo.minutes * 60_000
      settlePomodoro(state, nowMs)
    }
    if (typeof patch.pomodoro.todayDone === 'number' && Number.isFinite(patch.pomodoro.todayDone)) {
      pomo.todayDone = clamp(Math.round(patch.pomodoro.todayDone), 0, 999)
      pomo.day = dayKeyFor(nowMs)
    }
  }

  // 形态（C1）：调试页要能直接变成猪猪王 / 恶魔猪，条件不看。传 null 恢复普通。
  if (patch.form === null) state.form = null
  else if (typeof patch.form === 'string' && formByKey(patch.form) !== null) {
    recordDex(state, 'forms', patch.form, nowMs)
    state.form = patch.form
  }

  // Preview any built-in look, including a career the current pig has not earned yet.
  if (typeof patch.skin === 'string' && skinByKey(patch.skin) !== null) {
    recordDex(state, 'skins', patch.skin, nowMs)
    state.skin = patch.skin
  }

  if (patch.activity === null) state.activity = null
  if (patch.outingStreak === 0) state.outingStreak = 0

  // G 批次调试页：设签到到第几天（今天还没签）、礼包攒几个、让猪说某个场景的一句话。
  if (Number.isInteger(patch.signInDay) && patch.signInDay >= 1 && patch.signInDay <= SIGN_IN_CYCLE) {
    const daily = ensureDaily(state)
    daily.signIn.index = patch.signInDay - 1
    daily.signIn.lastDay = null
  }
  if (Number.isInteger(patch.gifts) && patch.gifts >= 0) ensureDaily(state).online.unclaimed = Math.min(patch.gifts, 3)
  if (typeof patch.say === 'string' && Object.hasOwn(LINES, patch.say)) say(state, patch.say, nowMs)

  state.stage = lifeStageFor(state, nowMs).key
  state.lastSeenAt = nowMs
  remember(state, `🔧 开发者改了状态（${before.stage} → ${state.stage}）`, nowMs)
  return state
}

/** Start over with a fresh box. The old pig's story stays in `memories`. */
export function adopt(state, nowMs) {
  const fresh = inherit(state, layEgg(nowMs), nowMs)
  remember(fresh, '又领养了一只，纸盒里传来窸窸窣窣的声音 📦', nowMs)
  return Object.assign(state ?? {}, fresh)
}

// ---------------------------------------------------------------------------
// Creation and migration
// ---------------------------------------------------------------------------

export function revive(state, nowMs) {
  state.dead = false
  state.diedAt = null
  state.health = MAX.health
  state.satiety = Math.max(state.satiety, 60)
  state.cleanliness = Math.max(state.cleanliness, 60)
  state.happiness = Math.max(state.happiness, 50)
  state.illness = null
  state.activity = null
  state.outingStreak = 0
  state.stats.revives = (state.stats.revives ?? 0) + 1
  remember(state, `被 ${REVIVE_ITEM.label} 救了回来 ✨`, nowMs)
  announce(state, 'revived', `${state.name} 回来了 ✨`, nowMs)
  say(state, 'revive', nowMs)
}

// ---------------------------------------------------------------------------
// Naming and mood
// ---------------------------------------------------------------------------

export function rename(state, rawName, nowMs) {
  const cleaned = String(rawName ?? '').replace(/\s+/g, ' ').trim()
  if (cleaned === '' || [...cleaned].length > 16) return null
  state.name = cleaned
  remember(state, `改名叫「${cleaned}」`, nowMs)
  return cleaned
}
