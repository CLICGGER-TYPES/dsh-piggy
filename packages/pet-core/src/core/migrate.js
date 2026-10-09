// @ts-check
import { settleAchievements } from './achievements.js'
/**
 * 存档迁移与字段清洗。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/migrate
 */

import { ensureExtensions } from './extensions.js'
import { BOX_TICKET, ILLNESS_CHAINS, INTERESTS, formByKey, MAX, SHOP, SOUVENIR_RARITY, TRAIT_ORDER, interestByKey, itemByKey, jobByKey, schoolStageByKey, subjectByKey, tripByKey } from '../data.js'
import { MEMORY_LIMIT, STATE_VERSION } from './constants.js'
import { clamp, clamp100 } from './effects.js'
import { layEgg, pickSex } from './egg.js'
import { ensureDaily } from './daily.js'
import { ensureDiary } from './diary.js'
import { ensurePomodoro } from './pomodoro.js'
import { ensureDialogue } from './lines.js'
import { ensureProfile } from './profile.js'
import { isSeed, seedFor } from './random.js'
import { applyUpgrades } from './upgrades.js'
import { ensureDex } from './dex.js'
import { ensureBodyWeight } from './weight.js'
import { ensureFishing } from './fishing.js'
import { ensureSkins } from './skins.js'
import { ensureEconomy } from './economy.js'
import { ensureWallets } from './wallets.js'

/** Fill in anything a hand-edited or older save is missing. */
export function migrate(input, nowMs) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null
  const onDiskVersion = typeof input.version === 'number' ? input.version : 0
  // Untrusted save data: every field below is checked before it is used.
  const raw = /** @type {any} */ (applyUpgrades(input, nowMs))
  const egg = layEgg(typeof raw.bornAt === 'number' ? raw.bornAt : nowMs)
  const state = { ...egg, ...raw }
  state.version = STATE_VERSION
  state.form = formByKey(raw.form)?.key ?? null
  state.stats = { ...egg.stats, ...(asObject(raw.stats) ?? {}) }
  state.stats.jobs = Number.isFinite(state.stats.jobs) ? Math.max(0, Math.floor(state.stats.jobs)) : 0
  state.cooldowns = { ...(asObject(raw.cooldowns) ?? {}) }
  state.inventory = sanitizeInventory(raw.inventory)
  // 王冠以前是 5200 的装扮（C3 里改名「礼冠」），现在只剩能加冕的王冠道具：
  // 买过的换成一顶王冠放进背包，不白花钱。换过之后装扮表里就没有它了，不会重复给。
  const oldCrown = [raw.dress, raw.worn].some(list => Array.isArray(list) && (list.includes('crown') || list.includes('royal-crown')))
  if (oldCrown) state.inventory.crown = (state.inventory.crown ?? 0) + 1
  state.dress = sanitizeDressList(raw.dress)
  // Only owned items can be worn, and unknown keys are dropped.
  state.worn = sanitizeDressList(raw.worn).filter(key => state.dress.includes(key))
  state.traits = sanitizeTraits(raw.traits)
  state.lessons = sanitizeLessons(raw.lessons)
  state.interests = sanitizeInterests(raw.interests)
  state.souvenirs = sanitizeSouvenirs(raw.souvenirs)
  state.pending = []
  state.memories = Array.isArray(raw.memories)
    ? raw.memories.filter(m => typeof m === 'string').slice(-MEMORY_LIMIT)
    : []

  for (const key of ['xp', 'weightG', 'satiety', 'happiness', 'cleanliness', 'health', 'coins', 'outingStreak', 'restMinutes', 'bornAt', 'lastFedAt', 'lastActiveAt', 'lastSeenAt']) {
    if (typeof state[key] !== 'number' || !Number.isFinite(state[key])) state[key] = egg[key]
  }
  if (typeof raw.cleanliness !== 'number') state.cleanliness = egg.cleanliness
  if (typeof raw.health !== 'number') state.health = raw.dead === true ? 0 : MAX.health
  if (typeof raw.coins !== 'number') state.coins = egg.coins
  // Starting money went 60 -> 500. A pig that hatched under the old number is
  // broke through no fault of its owner, so top it up once — and only once, by
  // keying off the version that was on disk when it was loaded.
  if (onDiskVersion < 5 && state.coins >= 0 && state.coins < egg.coins) {
    state.coins = egg.coins
  }
  if (typeof raw.diedAt !== 'number') state.diedAt = state.dead === true ? (raw.lastSeenAt ?? egg.bornAt) : null
  if (typeof state.stage !== 'string') state.stage = state.hatched === true ? 'piglet' : 'box'
  if (typeof state.name !== 'string' || state.name.trim() === '') state.name = egg.name

  state.health = clamp(Math.round(state.health), 0, MAX.health)
  state.satiety = clamp100(state.satiety)
  state.happiness = clamp100(state.happiness)
  state.cleanliness = clamp100(state.cleanliness)
  state.coins = Math.max(0, Math.floor(state.coins))
  state.illness = sanitizeIllness(raw.illness, nowMs)
  state.activity = sanitizeActivity(raw.activity ?? raw.work)
  state.dead = state.dead === true || state.health <= 0
  state.hatched = state.hatched === true
  if (!isSeed(state.seed)) state.seed = seedFor(state)
  if (state.hatched && state.sex !== 'boy' && state.sex !== 'girl') state.sex = pickSex(state)
  if (state.stage === 'elder') state.stage = 'middle'
  if (!Number.isInteger(state.pendingSeq) || state.pendingSeq < 0) state.pendingSeq = 0
  ensureDialogue(state)
  // B9: personality, catchphrase and motto — filled in for older pigs on load.
  ensureProfile(state)
  ensureDaily(state)
  ensureDiary(state)
  ensurePomodoro(state)
  ensureDex(state, nowMs)
  ensureBodyWeight(state)
  ensureFishing(state)
  ensureSkins(state)
  ensureEconomy(state)
  ensureWallets(state)
  ensureExtensions(state)
  settleAchievements(state, nowMs, { silent: true })
  return state
}

export function asObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

export function sanitizeInventory(raw) {
  const source = asObject(raw)
  if (source === null) return {}
  const out = {}
  for (const [key, count] of Object.entries(source)) {
    if (!Number.isFinite(count)) continue
    const n = Math.floor(count)
    // 盲盒券不在商店里卖，但要留着（签到 / 礼包送的）。
    if (n > 0 && (SHOP.some(item => item.key === key) || key === BOX_TICKET.key)) out[key] = n
  }
  return out
}

export function sanitizeTraits(raw) {
  const source = asObject(raw)
  const out = {}
  for (const key of TRAIT_ORDER) {
    const value = source?.[key]
    out[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  }
  return out
}

/** Lessons taken per subject (B4): known subject keys, whole positive counts. */
export function sanitizeLessons(raw) {
  const source = asObject(raw)
  if (source === null) return {}
  const out = {}
  for (const [key, count] of Object.entries(source)) {
    if (!Number.isFinite(count)) continue
    const n = Math.floor(count)
    if (n > 0 && subjectByKey(key) !== null) out[key] = n
  }
  return out
}

/**
 * Souvenirs became objects in 0.20.0 so they could carry a rarity and a story.
 * A save written before that holds bare strings ("贝壳"); wrap them so an old
 * collection stays visible and sellable instead of being dropped.
 */
export function sanitizeSouvenirs(raw) {
  if (!Array.isArray(raw)) return []
  // No cap: the shelf used to keep only the last 40, which threw away the
  // oldest keepsakes (and made them unsellable) without telling anyone.
  const out = []
  for (const entry of raw) {
    if (typeof entry === 'string' && entry !== '') {
      out.push({ key: entry, emoji: '🎁', label: entry, rarity: 'common', story: '', from: null, fromLabel: '' })
      continue
    }
    const source = asObject(entry)
    if (source === null || typeof source.key !== 'string' || source.key === '') continue
    out.push({
      key: source.key,
      emoji: typeof source.emoji === 'string' && source.emoji !== '' ? source.emoji : '🎁',
      label: typeof source.label === 'string' && source.label !== '' ? source.label : source.key,
      rarity: typeof source.rarity === 'string' && SOUVENIR_RARITY[source.rarity] !== undefined ? source.rarity : 'common',
      story: typeof source.story === 'string' ? source.story : '',
      from: typeof source.from === 'string' ? source.from : null,
      fromLabel: typeof source.fromLabel === 'string' ? source.fromLabel : '',
      ...(Number.isFinite(source.gotAt) ? { gotAt: source.gotAt } : {}),
    })
  }
  return out
}

/**
 * Owned / worn 装扮 keys. Unknown and duplicate keys are dropped, and only real
 * dress items survive, so a hand-edited save cannot dress the pig in a 药品.
 */
export function sanitizeDressList(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const key of raw) {
    if (typeof key !== 'string') continue
    const item = itemByKey(key)
    if (item === null || item.kind !== 'dress' || out.includes(key)) continue
    out.push(key)
  }
  return out
}

/** How many times each 兴趣课 has been taken; unknown keys are dropped. */
export function sanitizeInterests(raw) {
  const source = asObject(raw)
  if (source === null) return {}
  const out = {}
  for (const entry of INTERESTS) {
    const value = source[entry.key]
    if (Number.isFinite(value) && value > 0) out[entry.key] = Math.floor(value)
  }
  return out
}

export function sanitizeIllness(raw, nowMs) {
  const source = asObject(raw)
  if (source === null) return null
  const chain = Number.isInteger(source.chain) ? source.chain : -1
  const stage = Number.isInteger(source.stage) ? source.stage : 0
  if (chain < 0 || chain >= ILLNESS_CHAINS.length) return null
  if (stage < 1 || stage > ILLNESS_CHAINS[chain].stages.length) return null
  return {
    chain,
    stage,
    since: Number.isFinite(source.since) ? source.since : nowMs,
    progressMs: Number.isFinite(source.progressMs) ? Math.max(0, source.progressMs) : 0,
  }
}

/** Accepts both the v4 `activity` record and the v3 `work` record. */
export function sanitizeActivity(raw) {
  const source = asObject(raw)
  if (source === null) return null
  if (!Number.isFinite(source.endsAt)) return null
  const kind = source.kind ?? 'work'
  if (!['work', 'study', 'trip', 'interest', 'fishing'].includes(kind)) return null
  // A shift from an older job table survives if the upgrade priced it.
  const known = kind === 'work'
    ? jobByKey(source.key ?? source.job) !== null || Number.isFinite(source.legacyCoins)
    : kind === 'study'
      ? subjectByKey(source.key) !== null
      : kind === 'interest'
        ? interestByKey(source.key) !== null
        : kind === 'fishing'
          ? ['auto-30', 'auto-60'].includes(source.key)
          : tripByKey(source.key) !== null
  if (!known) return null
  return {
    kind,
    key: source.key ?? source.job,
    stage: kind === 'study' && schoolStageByKey(source.stage) !== null ? source.stage : undefined,
    label: typeof source.label === 'string' ? source.label : '',
    emoji: typeof source.emoji === 'string' ? source.emoji : '',
    startedAt: Number(source.startedAt) || 0,
    endsAt: source.endsAt,
    cost: Number(source.cost) || 0,
    ...(kind === 'fishing' && itemByKey(source.baitKey)?.kind === 'bait'
      ? { baitKey: source.baitKey, baitCount: Math.max(0, Math.min(20, Math.floor(Number(source.baitCount) || 0))) } : {}),
    ...(Number.isFinite(source.legacyCoins) ? { legacyCoins: source.legacyCoins, minutes: Number(source.minutes) || 0 } : {}),
    // 短班：只拿这一班的几分之几（0～1）。
    ...(kind === 'work' && Number.isFinite(source.share) && source.share > 0 && source.share < 1 ? { share: source.share } : {}),
  }
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------
