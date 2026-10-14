// @ts-check
/**
 * 离线自助餐与「撑不住」的后果。
 *
 * 玩家不在时猪按现有的照料管线自己用背包里的东西：饱食低就吃食物、清洁低就洗澡、
 * 心情低就玩玩具（阈值与选择规则都照搬现有照料，见 OFFLINE_NEEDS）。用完背包之后，
 * 没东西撑着满 10 天就是生命垂危、满 30 天就是死亡（2026-10-14 用户拍板）。
 *
 * 结算上限（背包能撑的天数 + 缓冲）也在这里算，和自动用背包放在同一处，别拆两处。
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/offline-feed
 */

import { MAX, SHOP, THRESHOLDS, careItems } from '../data.js'
import { DAY_MS, OFFLINE_DEATH_DAYS, OFFLINE_GRACE_DAYS, SATIETY_DECAY_PER_MIN } from './constants.js'
import { applySettledCare } from './care.js'
import { dayKeyFor } from './clock.js'
import { appendDiaryEntry } from './diary.js'
import { announce, remember } from './effects.js'
import { die } from './illness.js'

/**
 * 离线自动照料的三个需要。阈值照搬各自「该照料了」的那条线（core/views.js 的 mood() 用的
 * 就是这几个）：饱食 25、清洁 35、心情 35（THRESHOLDS.lonely，不是发病线的 sadBelow 30，
 * 宁可早照顾一点）。
 */
export const OFFLINE_NEEDS = Object.freeze([
  Object.freeze({ action: 'feed', kind: 'food', bar: 'satiety', threshold: THRESHOLDS.hungry }),
  Object.freeze({ action: 'bathe', kind: 'bath', bar: 'cleanliness', threshold: THRESHOLDS.dirty }),
  Object.freeze({ action: 'play', kind: 'toy', bar: 'happiness', threshold: THRESHOLDS.lonely }),
])

/**
 * 每类能用的背包道具（免费的默认玩具不算「背包里的东西」，玩家没买玩具就不玩）。
 * 货架是静态的，只在模块加载时算一次：长离线每 5 分钟一步，每步再过滤一遍整个商店会
 * 白白花掉几百毫秒（实测 100 天结算从 775ms 降到 100ms 上下）。
 */
const OFFLINE_SHELF = Object.freeze({
  food: Object.freeze(careItems('food').filter(item => item.default !== true)),
  bath: Object.freeze(careItems('bath').filter(item => item.default !== true)),
  toy: Object.freeze(careItems('toy').filter(item => item.default !== true)),
})

function offlineItems(state, kind) {
  const out = []
  for (const item of OFFLINE_SHELF[kind]) {
    if ((state.inventory?.[item.key] ?? 0) > 0) out.push(item)
  }
  return out
}

/**
 * 按价格选能越过阈值的那一个；不够就越过无望时优先回复最多的。和食物一样的规则。
 * @param {object} state
 * @param {typeof OFFLINE_NEEDS[number]} need
 */
export function pickOfflineItem(state, need) {
  const items = offlineItems(state, need.kind).filter(item => (item[need.bar] ?? 0) > 0)
  const enough = items.filter(item => state[need.bar] + item[need.bar] > need.threshold)
  return enough.sort((left, right) => left.price - right.price)[0]
    ?? items.sort((left, right) => right[need.bar] - left[need.bar] || left.price - right.price)[0]
}

/**
 * 在发生时刻照护一次（三类都走正常照料管线，扣库存、加属性）。只有离线结算才会
 * 传入汇总对象；汇总按类分开，回来时好念成「吃了…洗了…玩了…」。
 * @param {object} state
 * @param {{counts: Record<string, Record<string, number>>, isEmpty: boolean}|null} meals
 * @param {number} nowMs
 */
export function careOffline(state, meals, nowMs) {
  if (!meals || state.dead) return
  for (const need of OFFLINE_NEEDS) {
    while (state[need.bar] <= need.threshold) {
      const item = pickOfflineItem(state, need)
      if (item === undefined) {
        // 只有食物关系到生死：没吃的就记一笔「背包里没吃的了」。
        if (need.kind === 'food') meals.isEmpty = true
        break
      }
      const result = applySettledCare(state, { action: need.action, nowMs, itemKey: item.key })
      if (!result.ok) break
      if (result.spent) meals.counts[need.kind][item.key] = (meals.counts[need.kind][item.key] ?? 0) + 1
    }
  }
}

/** 每类一份新的计数表。 */
export const emptyOfflineMeals = () => ({ counts: { food: {}, bath: {}, toy: {} }, isEmpty: false })

/**
 * 单次结算能推算多久（毫秒）：背包还能喂饱猪多少天 + OFFLINE_GRACE_DAYS 的缓冲。
 *
 * 只算食物：生死看有没有吃的（用户原话「背包有吃的能撑」）。清洁和心情撑不住的后果按
 * 现有发病规则走（onsetRisks()：脏 → 咳嗽／皮肤，心情差 → 头晕），不在这里另造因果。
 * 自动用背包关掉时当作一点东西都没有——玩家自己关的，猪就饿着。
 * @param {object} state
 */
export function offlineSustainMs(state) {
  if (state === null || state.isOfflineFeedEnabled === false) return 0
  const need = OFFLINE_NEEDS[0]
  const foods = offlineItems(state, need.kind).filter(item => (item[need.bar] ?? 0) > 0)
  if (foods.length === 0) return 0
  // 吃到阈值线就停，所以一份食物最多补到「从阈值线到满」这么多，超出的部分是浪费。
  const cap = MAX.satiety - need.threshold
  const stock = foods.reduce((sum, item) => sum + (state.inventory?.[item.key] ?? 0) * Math.min(item[need.bar], cap), 0)
  const buffer = Math.max(0, (Number.isFinite(state.satiety) ? state.satiety : 0) - need.threshold)
  // 用在家的衰减速率：离开的那段里就算有在外活动，它也只是一小截，估个整就好。
  return ((buffer + stock) / (SATIETY_DECAY_PER_MIN * 1440)) * DAY_MS
}

/**
 * 推算完还有剩余时间时给结果：没东西撑着满 OFFLINE_DEATH_DAYS 天直接死亡（墓碑），
 * 否则生命垂危。
 *
 * 「垂危」用现有的健康 1 格表示：那本来就是「太虚弱不能出门」那一档（TOO_WEAK_HEALTH），
 * 面板的健康条会显示 1/5。没有专属的「垂危」心情／立绘，文案见
 * results/fix-offline-clock/文案稿.md（待用户确认）。
 * @param {object} state
 * @param {number} nowMs
 * @param {number} unsupportedMs - 背包撑住之后又多出来的时间（没东西撑着的那段）
 */
export function settleStarvation(state, nowMs, unsupportedMs) {
  if (state.dead === true || state.hatched !== true) return
  if (!(unsupportedMs > OFFLINE_GRACE_DAYS * DAY_MS)) return
  if (unsupportedMs >= OFFLINE_DEATH_DAYS * DAY_MS) {
    die(state, nowMs, '太久没吃东西，撑不住了')
    return
  }
  if (state.health > 1) {
    state.health = 1
    remember(state, '💔 生命垂危：太久没有东西吃', nowMs)
    announce(state, 'weak', `${state.name} 生命垂危了，快喂点东西`, nowMs)
  }
}

const SUMMARY_VERB = Object.freeze({ food: '吃了', bath: '洗了', toy: '玩了' })

/** 回来时提示与日记写同一份摘要，不让每一口挤满消息队列。 */
export function finishOfflineMeals(state, meals, nowMs) {
  if (!meals) return
  const parts = []
  for (const kind of ['food', 'bath', 'toy']) {
    const entries = Object.entries(meals.counts[kind] ?? {})
      .map(([key, count]) => `${SHOP.find(item => item.key === key)?.label ?? key}×${count}`)
    if (entries.length > 0) parts.push(`${SUMMARY_VERB[kind]} ${entries.join('、')}`)
  }
  const text = [parts.length ? `你不在的时候，猪猪自己${parts.join('、')}` : '', meals.isEmpty ? '背包里没吃的了' : ''].filter(Boolean).join('；')
  if (!text) return
  remember(state, text, nowMs)
  announce(state, 'offline-food', text, nowMs)
  appendDiaryEntry(state, dayKeyFor(nowMs), text)
}

/** 玩法开关跟随存档，两种宿主使用同一个动作。 */
export function setOfflineFeed(state, on) {
  state.isOfflineFeedEnabled = on === true
  return { ok: true }
}
