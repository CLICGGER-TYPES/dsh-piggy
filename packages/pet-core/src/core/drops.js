// @ts-check
/**
 * 打工、上课回来随手带的东西。
 *
 * 纯函数领域逻辑：随机数来自 core/random.js（见 docs/CONVENTIONS.md）。
 * 数字见 data/drops.js（docs/numbers/B4-study-jobs.md §4）。
 * @module dsh-piggy/core/drops
 */

import {
  DROP_SHELVES,
  GRADUATION_DROP_COUNT,
  GRADUATION_DROP_PRICE,
  SHOP,
  STUDY_DROP_CHANCE,
  STUDY_DROP_MAX_PRICE,
  WORK_DROP,
  WORK_DROP_VALUE_RATIO,
} from '../data.js'
import { chance, pickOne } from './random.js'
import { recordDex } from './dex.js'

/**
 * One item: pick a shelf by weight, then an item on it within the price range.
 * A shelf with nothing in range falls back to its cheapest item, so a drop is
 * never silently lost.
 * @param {import('./random.js').Roll} next
 * @param {{min?: number, max: number}} price
 * @param {ReadonlyArray<{kinds: ReadonlyArray<string>, weight: number, tier?: number}>} shelves
 */
function pickItem(next, price, shelves) {
  const total = shelves.reduce((sum, shelf) => sum + shelf.weight, 0)
  let point = next() * total
  let shelf = shelves[0]
  for (const candidate of shelves) {
    shelf = candidate
    point -= candidate.weight
    if (point < 0) break
  }
  const onShelf = SHOP.filter(item =>
    shelf.kinds.includes(item.kind) && item.default !== true && item.cureAll !== true
    && (shelf.tier === undefined || item.tier === shelf.tier))
  const inRange = onShelf.filter(item => item.price <= price.max && item.price >= (price.min ?? 0))
  const pool = inRange.length > 0 ? inRange : onShelf.slice().sort((a, b) => a.price - b.price).slice(0, 1)
  return pickOne(next, pool)
}

/**
 * Put `count` random items in the bag.
 * @returns {Array<{key: string, label: string, emoji: string}>} what was given
 */
function give(state, count, next, price, shelves = DROP_SHELVES, nowMs = 0) {
  const given = []
  for (let index = 0; index < count; index += 1) {
    const item = pickItem(next, price, shelves)
    if (item === null) continue
    recordDex(state, 'items', item.key, nowMs)
    state.inventory = { ...(state.inventory ?? {}) }
    state.inventory[item.key] = (state.inventory[item.key] ?? 0) + 1
    given.push({ key: item.key, label: item.label, emoji: item.emoji })
  }
  return given
}

/** After a shift: sometimes one thing, now and then two, each worth ≤ 30% of the pay. */
export function workDrops(state, pay, next, nowMs = 0) {
  const roll = next()
  const count = roll < WORK_DROP.two ? 2 : roll < WORK_DROP.two + WORK_DROP.one ? 1 : 0
  return give(state, count, next, { max: Math.max(1, pay * WORK_DROP_VALUE_RATIO) }, DROP_SHELVES, nowMs)
}

/** After a lesson: now and then one small thing. */
export function studyDrops(state, next, nowMs = 0) {
  return chance(next, STUDY_DROP_CHANCE) ? give(state, 1, next, { max: STUDY_DROP_MAX_PRICE }, DROP_SHELVES, nowMs) : []
}

/** A graduation: three things from the better shelves, no medicine. */
export function graduationDrops(state, next, nowMs = 0) {
  const shelves = DROP_SHELVES.filter(shelf => !shelf.kinds.includes('medicine'))
  return give(state, GRADUATION_DROP_COUNT, next, GRADUATION_DROP_PRICE, shelves, nowMs)
}

/** "苹果、香皂" with their emoji — for the announcements. */
export const describeDrops = given => given.map(item => `${item.emoji}${item.label}`).join('、')
