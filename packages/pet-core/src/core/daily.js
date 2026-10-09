// @ts-check
/**
 * 日常：签到 12 天、在线礼包、宠物日记。
 *
 * 纯领域逻辑：时间由 nowMs 传入，随机走 `core/random.js`，不读文件、不碰 DOM。
 * 一天的边界是早上 06:00 —— `dayKeyFor()` 就在 clock.js，这里只是转出去，
 * 免得「一天从几点算起」有两份实现（见 docs/CONVENTIONS.md）。
 *
 * @module dsh-piggy/core/daily
 */
import { BOX_TICKET, BOX_TICKET_CHANCE, GIFT_TABLE, ONLINE_GIFT, SIGN_IN_CYCLE, SIGN_IN_REWARDS, SHOP, itemByKey } from '../data.js'
import { dayKeyFor } from './clock.js'
import { rollerFor } from './random.js'
import { announce, remember } from './effects.js'
import { say } from './lines.js'
import { recordDex } from './dex.js'
import { earnCoins } from './economy.js'

export { dayKeyFor }

/** 一份全新的日常状态：今天没签、没在线、没礼包。 */
export function emptyDaily() {
  return {
    signIn: { lastDay: null, index: 0, total: 0, cycle7: true },
    online: { day: null, onlineMs: 0, given: 0, unclaimed: 0 },
  }
}

/**
 * 补默认值。新字段不加 upgrades 级、不动 STATE_VERSION（那归 Claude）：
 * 缺什么补什么，坏值当没有（参考 core/lines.js 的 ensureDialogue）。
 * @param {object} state
 */
export function ensureDaily(state) {
  const raw = state.daily
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    state.daily = emptyDaily()
    return state.daily
  }
  const signIn = raw.signIn !== null && typeof raw.signIn === 'object' && !Array.isArray(raw.signIn) ? raw.signIn : {}
  const online = raw.online !== null && typeof raw.online === 'object' && !Array.isArray(raw.online) ? raw.online : {}
  let index = Number.isInteger(signIn.index) && signIn.index >= 0 ? signIn.index : 0
  // G1（用户 2026-10-05 确认）：签到从 12 天改成 7 天。老存档正在第 8～12 天的，回到第 1 天，
  // 并补发一份第 7 天礼包，不让人吃亏；第 1～7 天的原样接着领。只换算一次（cycle7 标记）。
  let compensated = false
  if (signIn.cycle7 !== true && index >= SIGN_IN_CYCLE) { index = 0; compensated = true }
  state.daily = {
    signIn: {
      lastDay: typeof signIn.lastDay === 'string' && signIn.lastDay !== '' ? signIn.lastDay : null,
      index: index % SIGN_IN_CYCLE,
      total: Number.isInteger(signIn.total) && signIn.total >= 0 ? signIn.total : 0,
      cycle7: true,
    },
    online: {
      day: typeof online.day === 'string' && online.day !== '' ? online.day : null,
      onlineMs: Number.isFinite(online.onlineMs) && online.onlineMs > 0 ? online.onlineMs : 0,
      given: Number.isInteger(online.given) && online.given >= 0 ? online.given : 0,
      unclaimed: Number.isInteger(online.unclaimed) && online.unclaimed >= 0 ? online.unclaimed : 0,
    },
  }
  if (compensated) {
    const text = grantReward(state, SIGN_IN_REWARDS[SIGN_IN_CYCLE - 1])
    remember(state, `📅 签到改成 7 天一轮，补发第 7 天礼包：${text}`, 0)
  }
  return state.daily
}

/**
 * 把一份奖励记到账上。
 * @param {object} state
 * @param {{coins: number, items: ReadonlyArray<{key: string, count: number}>}} reward
 * @returns {string} 领到了什么（给公告用）
 */
export function grantReward(state, reward, nowMs = 0) {
  const parts = []
  if (reward.coins > 0) {
    earnCoins(state, reward.coins, 'daily', nowMs)
    parts.push(`🪙 ${reward.coins}`)
  }
  for (const entry of reward.items) {
    recordDex(state, 'items', entry.key, nowMs, entry.count)
    state.inventory = { ...(state.inventory ?? {}) }
    state.inventory[entry.key] = (state.inventory[entry.key] ?? 0) + entry.count
    const item = itemByKey(entry.key)
    // A key the shelf does not know yet (B3's medicine) still lands in the bag.
    parts.push(`${item === null ? '🎁' : item.emoji} ${item === null ? entry.key : item.label} ×${entry.count}`)
  }
  return parts.join(' + ')
}

/**
 * 装了盲盒的猪，签到 / 礼包偶尔多给一张盲盒券。返回追加的文字（没给就是空串）。
 * @param {any} state @param {number} chanceOf @param {() => number} next
 */
function maybeTicket(state, chanceOf, next) {
  const installed = state.extData?.[BOX_TICKET.extension] !== undefined && state.extensions?.[BOX_TICKET.extension] !== false
  if (!installed || next() >= chanceOf) return ''
  state.inventory = { ...(state.inventory ?? {}), [BOX_TICKET.key]: (state.inventory?.[BOX_TICKET.key] ?? 0) + 1 }
  return ` + ${BOX_TICKET.emoji} ${BOX_TICKET.label} ×1`
}

/** 今天这一签领了没。 */
export function canSignIn(state, nowMs) {
  return ensureDaily(state).signIn.lastDay !== dayKeyFor(nowMs)
}

/**
 * 签到：发当天的礼包、推进一轮，写回今天是哪一天。
 *
 * 断签不清零（下次接着领下一天），12 天领完从头来；死了也能签 —— 墓碑也攒还魂丹。
 * @returns {{ ok: boolean, reason?: string, day?: number, reward?: string }}
 */
export function signIn(state, nowMs) {
  const daily = ensureDaily(state)
  const today = dayKeyFor(nowMs)
  if (daily.signIn.lastDay === today) return { ok: false, reason: 'signed' }
  const index = daily.signIn.index % SIGN_IN_CYCLE
  const text = grantReward(state, SIGN_IN_REWARDS[index], nowMs) + maybeTicket(state, BOX_TICKET_CHANCE.signIn, rollerFor(state))
  daily.signIn.lastDay = today
  daily.signIn.index = (index + 1) % SIGN_IN_CYCLE
  daily.signIn.total += 1
  announce(state, 'gift', `签到第 ${index + 1} 天：${text}`, nowMs)
  say(state, 'signIn', nowMs)
  return { ok: true, day: index + 1, reward: text }
}

/**
 * 记一段在线时长。
 *
 * 纯函数：`lastPollMs` 是上一次轮询的时刻，由宿主（store）传进来。
 * **只算真实毫秒**，跟调试页的时间倍率无关；两次轮询间隔超过 30 秒就当作
 * 「人不在」，中间那段不算。跨天（06:00）时清零当日进度，但**没领的礼包留着**。
 */
export function recordOnline(state, lastPollMs, nowMs) {
  const daily = ensureDaily(state)
  const today = dayKeyFor(nowMs)
  if (daily.online.day !== today) {
    daily.online.day = today
    daily.online.onlineMs = 0
    daily.online.given = 0
    // unclaimed 不清：攒着的礼包换天还在，用户回来能一起领。
  }
  const gap = nowMs - lastPollMs
  if (lastPollMs > 0 && gap > 0 && gap <= ONLINE_GIFT.pollGapMaxMs) daily.online.onlineMs += gap
  // 每满一小时一个，不设每天上限（用户 2026-10-09）；没领的攒满 3 个就先不给，领了再攒。
  while (daily.online.onlineMs >= ONLINE_GIFT.perGiftMs) {
    daily.online.onlineMs -= ONLINE_GIFT.perGiftMs
    if (daily.online.unclaimed < ONLINE_GIFT.unclaimedMax) {
      daily.online.given += 1
      daily.online.unclaimed += 1
    }
  }
  return daily.online
}

/**
 * 抽一个礼包内容（纯函数，随机来自 state.seed）。
 * @returns {{coins: number, items: ReadonlyArray<{key: string, count: number}>}}
 */
export function pickGift(state, next) {
  return resolveGiftBucket(GIFT_TABLE[giftBucketIndex(next())], next)
}

/**
 * Which row of `GIFT_TABLE` a `[0, 1)` roll lands on（抽出来是为了能测分布）。
 * @param {number} roll
 * @returns {number} GIFT_TABLE 的下标
 */
export function giftBucketIndex(roll) {
  let accumulated = 0
  for (let index = 0; index < GIFT_TABLE.length; index += 1) {
    accumulated += GIFT_TABLE[index].chance
    if (roll < accumulated) return index
  }
  // Floating point can leave the sum a hair under 1: fall back to the common case.
  return 0
}

/** @param {object} bucket @param {() => number} next */
function resolveGiftBucket(bucket, next) {
  if (bucket.coins !== undefined) {
    const [low, high] = bucket.coins
    return { coins: low + Math.floor(next() * (high - low + 1)), items: [] }
  }
  if (bucket.keys !== undefined && bucket.keys.length > 0) {
    const key = bucket.keys[Math.min(bucket.keys.length - 1, Math.floor(next() * bucket.keys.length))]
    return { coins: 0, items: [{ key, count: 1 }] }
  }
  const kinds = bucket.kinds ?? (bucket.kind === undefined ? [] : [bucket.kind])
  const pool = SHOP.filter(item => kinds.includes(item.kind)
    && (bucket.maxPrice === undefined || item.price <= bucket.maxPrice))
  if (pool.length === 0) return { coins: 30, items: [] }
  const item = pool[Math.min(pool.length - 1, Math.floor(next() * pool.length))]
  return { coins: 0, items: [{ key: item.key, count: 1 }] }
}

/** 现在有没有没领的礼包。 */
export function giftsWaiting(state) {
  return ensureDaily(state).online.unclaimed
}

/**
 * 开一个在线礼包：抽一项、发到账上、公告 + 说一句。
 * @returns {{ ok: boolean, reason?: string, reward?: string }}
 */
export function openGift(state, nowMs) {
  const daily = ensureDaily(state)
  if (daily.online.unclaimed <= 0) return { ok: false, reason: 'empty' }
  daily.online.unclaimed -= 1
  const next = rollerFor(state)
  const text = grantReward(state, pickGift(state, next), nowMs) + maybeTicket(state, BOX_TICKET_CHANCE.gift, next)
  announce(state, 'gift', `在线礼包：${text}`, nowMs)
  say(state, 'gift', nowMs)
  return { ok: true, reward: text }
}

/** 面板需要的那几个数。 */
export function dailyView(state, nowMs) {
  const daily = ensureDaily(state)
  return {
    canSignIn: daily.signIn.lastDay !== dayKeyFor(nowMs),
    signInDay: (daily.signIn.index % SIGN_IN_CYCLE) + 1,
    signInTotal: daily.signIn.total,
    cycle: SIGN_IN_CYCLE,
    unclaimed: daily.online.unclaimed,
    onlineMinutes: Math.floor(daily.online.onlineMs / 60000),
  }
}
