// @ts-check
/**
 * 成长值与等级 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 数字全部来自 docs/numbers/B2-growth.md（用户 2026-10-01 确认）。
 * 参考 QQ 宠物 GrowUp.js：成长值随时间自己涨，心情、健康、饿、脏会拖慢它 ——
 * 照顾得好就长得快。去掉的是原版 400 级的肝和粉钻加速。
 *
 * 存档里的 `xp` 字段就是成长值（沿用旧字段名，免得全库改名）。
 *
 * @module dsh-piggy/data/growth
 */

/** 满级。满级后成长值照样累计，只是不再升级。 */
export const MAX_LEVEL = 60

/** 等级曲线系数：到达 L 级需要的累计成长值 = K × L²。 */
export const GROWTH_CURVE_K = 122

/**
 * Growth needed to *reach* a level: 122 × L². Lv10 ≈ 5 days, Lv40 ≈ 2.7
 * months, Lv60 ≈ 6 months at full care and the base rate alone.
 * @param {number} level
 */
export const xpForLevel = level => (level <= 1 ? 0 : GROWTH_CURVE_K * level * level)

/** 猪时间每小时的基础成长值（关着 DSH 也长）。 */
export const GROWTH_PER_HOUR = 100

/**
 * 心情档位对成长速度的系数，按从高到低找第一个满足 `min` 的档。
 * 原版按 1000 分制扣 20/70/100/140/180（基础 260），这里折成百分比取整。
 */
export const MOOD_GROWTH_FACTORS = Object.freeze([
  Object.freeze({ min: 70, factor: 1 }),
  Object.freeze({ min: 50, factor: 0.9 }),
  Object.freeze({ min: 30, factor: 0.7 }),
  Object.freeze({ min: 0, factor: 0.5 }),
])

/** 饿（饱食 < THRESHOLDS.hungry）或脏（清洁 < THRESHOLDS.dirty）时的系数，两者只算一次。 */
export const NEGLECT_GROWTH_FACTOR = 0.7

/** 生病时每少 1 格健康，成长速度少 15%。 */
export const SICK_GROWTH_PENALTY_PER_HEALTH = 0.15

/** 各项系数相乘后的下限：再惨也不会完全不长。 */
export const MIN_GROWTH_FACTOR = 0.1

/** 陪主人真实干活给的成长值（每轮对话 / 每次工具调用）。 */
export const DSH_GROWTH = Object.freeze({ turn: 3, tool: 1 })

/** 真实干活加成每天的上限（约等于多养 3 小时）。 */
export const DSH_GROWTH_DAILY_CAP = 300

/** 打工、旅行：每小时 +25 成长值（按活动时长折算）。 */
export const WORK_GROWTH_PER_HOUR = 25

/** 每上一节课 +40（兴趣课同）。 */
export const STUDY_GROWTH_PER_LESSON = 40

/** 某门课毕业（第 9/20/40/95 节）额外 +500（B4 接上）。 */
export const GRADUATION_GROWTH = 500

/** 一天从几点算起：06:00 以前还算前一天（签到、在线礼包、日记、每日上限共用）。 */
export const DAY_STARTS_AT_HOUR = 6

/** 性别：拆纸盒时 50/50 定下来。 */
export const SEXES = Object.freeze({
  boy: Object.freeze({ key: 'boy', label: '男孩', symbol: '♂' }),
  girl: Object.freeze({ key: 'girl', label: '女孩', symbol: '♀' }),
})
