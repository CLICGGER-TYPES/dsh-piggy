// @ts-check
/**
 * 打工、上课回来带的东西 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 数字来自 docs/numbers/B4-study-jobs.md §4（用户 2026-10-01 确认）。
 * 参考 QQ 宠物：打工回来 75% 带 1 件、25% 带 2 件；这里给得少一点，因为钱多。
 *
 * @module dsh-piggy/data/drops
 */

/** 打工回来：带 2 件 / 带 1 件的概率（其余什么都不带）。 */
export const WORK_DROP = Object.freeze({ two: 0.15, one: 0.5 })

/** 上课回来：带 1 件的概率。 */
export const STUDY_DROP_CHANCE = 0.3

/** 毕业（某门课第 9 / 20 / 40 / 95 节）：必得几件。 */
export const GRADUATION_DROP_COUNT = 3

/** 抽到哪一类：食物 / 日用品和玩具 / 1 级药。 */
export const DROP_SHELVES = Object.freeze([
  Object.freeze({ kinds: Object.freeze(['food']), weight: 0.45 }),
  Object.freeze({ kinds: Object.freeze(['bath', 'toy']), weight: 0.4 }),
  Object.freeze({ kinds: Object.freeze(['medicine']), weight: 0.15, tier: 1 }),
])

/** 打工掉落单件价值上限 = 这班报酬 × 0.3。 */
export const WORK_DROP_VALUE_RATIO = 0.3

/** 上课掉落单件价值上限。 */
export const STUDY_DROP_MAX_PRICE = 40

/** 毕业礼从「高一档」货架抽：价格在这个区间的食物、日用品、玩具。 */
export const GRADUATION_DROP_PRICE = Object.freeze({ min: 30, max: 150 })
