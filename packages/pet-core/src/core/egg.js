// @ts-check
/**
 * 新猪的初始状态。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/egg
 */

import { DEFAULT_TIME_SCALE, MAX } from '../data.js'
import { BIRTH_WEIGHT_G, HATCH_WEIGHT_G, STATE_VERSION } from './constants.js'
import { remember } from './effects.js'
import { emptyDex } from './dex.js'
import { emptyFishing } from './fishing.js'
import { emptyDialogue } from './lines.js'
import { assignPersonality } from './profile.js'
import { roll } from './random.js'

export function layEgg(nowMs) {
  return {
    version: STATE_VERSION,
    name: '猪猪',
    bornAt: nowMs,
    hatched: false,
    dead: false,
    /** When the pig died, so the grave can be left alone long enough for a soul. */
    diedAt: null,
    /** Last stage the panel announced; drives the "grew up" message. */
    stage: 'box',
    /** 加冕选的形态（data/evolution.js 的 key），null 是普通的猪。 */
    form: null,
    /** Selected cosmetic skin; forms always display above it. */
    skin: 'default',
    customSkins: [],
    /** Optional daily exercise record; old saves get it through ensureBodyWeight. */
    bodyWeight: { playDay: '', plays: 0 },
    /** Accumulated pig time in ms — age is this, not wall clock. */
    ageMs: 0,
    /** 1 = the stage table is real months. See DEFAULT_TIME_SCALE. */
    timeScale: DEFAULT_TIME_SCALE,
    /** True when developer mode forced the age; the panel says so. */
    ageForced: false,
    xp: 0,
    weightG: BIRTH_WEIGHT_G,
    satiety: 70,
    happiness: 70,
    cleanliness: 90,
    health: MAX.health,
    // Enough to buy medicine on day one: at 60 a sick pig could not afford the
    // cheapest cure and had nothing left to earn it with.
    coins: 500,
    inventory: {},
    isOfflineFeedEnabled: true,
    // 家当: dress items are bought once, owned forever, and worn.
    dress: [],
    worn: [],
    dex: emptyDex(),
    fishing: emptyFishing(),
    traits: { intel: 0, charm: 0, strong: 0 },
    // Lessons taken per subject (B4): the count decides the subject's stage
    // and which jobs the pig qualifies for.
    lessons: {},
    // 兴趣课修读次数；满 CERTIFICATE_AFTER 次拿证。
    interests: {},
    souvenirs: [],
    illness: null,
    activity: null,
    outingStreak: 0,
    restMinutes: 0,
    lastFedAt: 0,
    lastActiveAt: nowMs,
    lastSeenAt: nowMs,
    // 时钟回拨后第一次被看到的时刻（倒退后的新时钟读数）；只在冻结期间有值，
    // 用来判断这个倒退是不是「用户改了系统时间」（见 core/clock.js 的 holdClock）。
    clockRollbackAt: null,
    cooldowns: {},
    pending: [],
    pendingSeq: 0,
    dialogue: emptyDialogue(),
    memories: [],
    stats: {
      turns: 0, messages: 0, tools: 0, toolErrors: 0, agentErrors: 0,
      levelUps: 0, feeds: 0, baths: 0, plays: 0, pets: 0,
      jobs: 0, coinsEarned: 0, purchases: 0, illnesses: 0, cures: 0, deaths: 0, revives: 0,
      courses: 0, lessons: 0, trips: 0, sales: 0, interests: 0,
      fishCaught: 0, fishingAuto: 0,
    },
  }
}

/**
 * Open the box. The piglet falls out — it does not start as a fully grown pig,
 * and `ageDays` starts counting from the moment it does.
 */
/**
 * Open an existing box in place, keeping everything the save already has.
 * `hatchEgg` builds a brand new pig; this one just lets the piglet out.
 */
export function hatch(state, nowMs) {
  state.hatched = true
  // A new body starts at Lv1: anything the box picked up before it opened
  // (older saves let it eat real work) does not count toward growing up.
  state.xp = 0
  state.sex = pickSex(state)
  assignPersonality(state)
  state.bornAt = nowMs
  state.ageForced = false
  state.dead = false
  state.diedAt = null
  state.stage = 'piglet'
  state.weightG += HATCH_WEIGHT_G
  state.health = Math.max(state.health, 1)
  remember(state, '纸盒打开了，一只小猪蹦了出来 🐷', nowMs)
  return state
}

export function hatchEgg(nowMs) {
  const state = layEgg(nowMs)
  state.hatched = true
  state.sex = pickSex(state)
  assignPersonality(state)
  state.bornAt = nowMs
  state.ageForced = false
  state.weightG += HATCH_WEIGHT_G
  state.stage = 'piglet'
  remember(state, '纸盒打开了，一只小猪蹦了出来 🐷', nowMs)
  return state
}

/**
 * Boy or girl, 50/50, from the pig's own random sequence.
 * @param {object} state
 * @returns {'boy'|'girl'}
 */
export const pickSex = state => (roll(state) < 0.5 ? 'boy' : 'girl')
