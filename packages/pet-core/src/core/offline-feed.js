// @ts-check
/** 离线结算的背包自助餐：只选食物，效果走正常照料，回来时汇总一次。 */
import { SHOP, THRESHOLDS } from '../data.js'
import { applySettledCare } from './care.js'
import { dayKeyFor } from './clock.js'
import { appendDiaryEntry } from './diary.js'
import { announce, remember } from './effects.js'

/** 按价格选能恢复到饥饿线以上的食物；不足时优先回复最多的。 */
export function pickOfflineFood(state) {
  const foods = SHOP.filter(item => item.kind === 'food' && (item.satiety ?? 0) > 0 && (state.inventory?.[item.key] ?? 0) > 0)
  const enough = foods.filter(item => state.satiety + item.satiety > THRESHOLDS.hungry)
  return enough.sort((left, right) => left.price - right.price)[0]
    ?? foods.sort((left, right) => right.satiety - left.satiety || left.price - right.price)[0]
}

/** 在发生时刻吃一份；只有离线结算才会传入汇总对象。 */
export function eatOffline(state, meals, nowMs) {
  if (!meals || state.dead || state.satiety > THRESHOLDS.hungry) return
  while (state.satiety <= THRESHOLDS.hungry) {
    const item = pickOfflineFood(state)
    if (!item) { meals.isEmpty = true; return }
    const result = applySettledCare(state, { action: 'feed', nowMs, itemKey: item.key })
    if (!result.ok) return
    meals.counts[item.key] = (meals.counts[item.key] ?? 0) + 1
  }
}

/** 回来时提示与日记写同一份摘要，不让每一口挤满消息队列。 */
export function finishOfflineMeals(state, meals, nowMs) {
  if (!meals) return
  const eaten = Object.entries(meals.counts).map(([key, count]) => `${SHOP.find(item => item.key === key).label}×${count}`)
  const text = [eaten.length ? `你不在的时候，猪猪自己吃了 ${eaten.join('、')}` : '', meals.isEmpty ? '背包里没吃的了' : ''].filter(Boolean).join('；')
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
