// @ts-check
/**
 * 职业与门槛 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 数字全部来自 docs/numbers/B4-study-jobs.md（用户 2026-10-01 确认）：
 * 原版 18 种 + 新增 15 种，门槛 = 等级 + 某几门课的课时（+ 兴趣证书）。
 * 三维不再是门槛，只决定报酬加成（`trait` 是算加成用的那一维）。
 *
 * @module dsh-piggy/data/jobs
 */

import { CERTIFICATE_AFTER, interestByKey } from './interests.js'
import { SUBJECTS, subjectByKey } from './school.js'
import { TRAITS } from './traits.js'

/**
 * @typedef {object} JobRequires
 * @property {number} level
 * @property {Readonly<Record<string, number>>} [lessons] - 某几门课各要多少节
 * @property {number} [every] - 九门课每门都要这么多节
 * @property {{count: number, lessons: number}} [anyOf] - 任意 count 门课达到 lessons 节
 * @property {string} [certificate] - 要哪门兴趣课的证书（interest key）
 */

/** 每班饱食 / 清洁消耗，按时长分档（沿用 B4 以前的消耗比例）。 */
const COST_BY_MINUTES = Object.freeze({
  30: Object.freeze({ satiety: -6, cleanliness: -4 }),
  45: Object.freeze({ satiety: -8, cleanliness: -6 }),
  60: Object.freeze({ satiety: -15, cleanliness: -12 }),
  120: Object.freeze({ satiety: -18, cleanliness: -10 }),
  240: Object.freeze({ satiety: -34, cleanliness: -26 }),
  480: Object.freeze({ satiety: -60, cleanliness: -40 }),
})

/**
 * @param {string} key
 * @param {string} label
 * @param {string} emoji
 * @param {'intel'|'charm'|'strong'} trait
 * @param {number} minutes
 * @param {number} coins
 * @param {JobRequires} requires
 */
const job = (key, label, emoji, trait, minutes, coins, requires) =>
  Object.freeze({ key, label, emoji, trait, minutes, coins, ...COST_BY_MINUTES[minutes], requires: Object.freeze(requires) })

export const JOBS = Object.freeze([
  // --- 起步：不用上学 · 30–45 分钟 ------------------------------------------
  job('bricks', '搬砖', '🧱', 'strong', 30, 40, { level: 1 }),
  job('flyers', '发传单', '📄', 'charm', 30, 40, { level: 1 }),
  job('dishes', '洗碗工', '🍽', 'strong', 30, 45, { level: 3 }),
  job('delivery', '送外卖', '🛵', 'strong', 45, 70, { level: 5, lessons: { pe: 3 } }),
  // --- 小学毕业（某门课 9 节）· 1 小时 --------------------------------------
  job('mason', '泥瓦工', '🧱', 'strong', 60, 150, { level: 3, lessons: { labour: 9 } }),
  job('cashier', '收银员', '🧾', 'intel', 60, 150, { level: 5, lessons: { mathematics: 9 } }),
  job('florist', '花匠', '💐', 'charm', 60, 160, { level: 6, lessons: { manners: 9 } }),
  job('carpenter', '木匠', '🪚', 'strong', 60, 160, { level: 6, lessons: { labour: 9 } }),
  job('courier', '快递员', '📦', 'strong', 60, 170, { level: 8, lessons: { pe: 9, wushu: 9 } }),
  job('gardener', '园丁', '🌳', 'charm', 60, 180, { level: 9, lessons: { chinese: 9, art: 9 } }),
  job('guard', '保安', '🛡', 'strong', 60, 180, { level: 9, lessons: { politics: 9, wushu: 9 } }),
  job('actor', '演员', '🎭', 'charm', 60, 180, { level: 9, lessons: { manners: 9, labour: 9 } }),
  // --- 中学毕业（20 节）· 2 小时 --------------------------------------------
  job('chef', '厨师', '👨‍🍳', 'strong', 120, 480, { level: 12, lessons: { labour: 20, manners: 9 } }),
  job('singer', '歌手', '🎤', 'charm', 120, 500, { level: 12, lessons: { music: 20 } }),
  job('lawyer', '律师', '⚖️', 'intel', 120, 520, { level: 12, lessons: { politics: 20 } }),
  job('nurse', '护士', '💉', 'charm', 120, 520, { level: 14, lessons: { chinese: 20, manners: 20 } }),
  job('athlete', '运动员', '🏅', 'strong', 120, 540, { level: 14, lessons: { pe: 20, wushu: 20 } }),
  job('cartoonist', '漫画家', '✏️', 'charm', 120, 560, { level: 15, lessons: { art: 20, labour: 20 } }),
  job('police', '警察', '👮', 'strong', 120, 560, { level: 15, lessons: { politics: 20, wushu: 20 } }),
  job('songwriter', '词曲作者', '🎼', 'charm', 120, 560, { level: 15, lessons: { chinese: 20, music: 20 } }),
  // --- 大学毕业（40 节）· 4 小时 --------------------------------------------
  job('editor', '编辑', '📰', 'intel', 240, 1500, { level: 18, lessons: { chinese: 40 } }),
  job('photographer', '摄影师', '📷', 'charm', 240, 1600, { level: 18, lessons: { art: 40 }, certificate: 'photography' }),
  job('coach', '教练', '🏋', 'strong', 240, 1500, { level: 20, lessons: { pe: 40 }, certificate: 'fitness' }),
  job('programmer', '程序员', '💻', 'intel', 240, 1800, { level: 22, lessons: { mathematics: 40 }, certificate: 'coding' }),
  job('dancer', '舞蹈家', '💃', 'charm', 240, 1800, { level: 22, lessons: { music: 40, pe: 40 }, certificate: 'dancing' }),
  job('architect', '建筑师', '📐', 'intel', 240, 1800, { level: 24, lessons: { art: 40, mathematics: 40 } }),
  job('doctor', '医生', '🩺', 'intel', 240, 2000, { level: 26, lessons: { chinese: 40, mathematics: 40, politics: 20 } }),
  // --- 研究生（95 节，或九门都到 40）· 8 小时 -------------------------------
  job('scientist', '科研人员', '🔬', 'intel', 480, 4800, { level: 30, lessons: { chinese: 40, mathematics: 40, art: 40, pe: 40 } }),
  job('official', '公务员', '🏛', 'intel', 480, 5200, { level: 35, every: 40 }),
  job('professor', '大学教授', '👨‍🏫', 'intel', 480, 5600, { level: 40, anyOf: { count: 3, lessons: 95 } }),
  job('star', '明星', '🌟', 'charm', 480, 6000, { level: 40, lessons: { music: 95, manners: 95, art: 40 } }),
  job('astronaut', '宇航员', '🚀', 'strong', 480, 6400, { level: 45, lessons: { mathematics: 95, pe: 95, wushu: 40 } }),
  job('ceo', '总裁', '💼', 'intel', 480, 8000, { level: 50, lessons: { mathematics: 95, chinese: 95, manners: 95, politics: 40 } }),
])

export const jobByKey = key => JOBS.find(entry => entry.key === key) ?? null

/**
 * @typedef {object} Condition
 * @property {'level'|'lesson'|'every'|'anyOf'|'certificate'} kind
 * @property {string} text - 给面板看的一小段，如「🔢数学 9 节」
 * @property {number} need
 * @property {number} have
 * @property {boolean} met
 */

/**
 * Every condition a job has, met or not — the panel's 详情 lists them all
 * with a tick or a cross, rather than only what is missing.
 * @param {{requires: JobRequires}} target
 * @param {{level: number, lessons: Record<string, number>, interests: Record<string, number>}} pig
 * @returns {Condition[]}
 */
export function jobChecklist(target, pig) {
  const need = target.requires
  /** @type {Condition[]} */
  const out = []
  const lessonsOf = key => pig.lessons?.[key] ?? 0
  out.push({ kind: 'level', text: `Lv.${need.level}`, need: need.level, have: pig.level, met: pig.level >= need.level })
  for (const [key, count] of Object.entries(need.lessons ?? {})) {
    const subject = subjectByKey(key)
    if (subject === null) continue
    const have = lessonsOf(key)
    out.push({ kind: 'lesson', text: `${subject.emoji}${subject.label} ${count} 节`, need: count, have, met: have >= count })
  }
  if (need.every !== undefined) {
    const every = need.every
    const reached = SUBJECTS.filter(subject => lessonsOf(subject.key) >= every).length
    out.push({ kind: 'every', text: `九门课各 ${every} 节`, need: SUBJECTS.length, have: reached, met: reached >= SUBJECTS.length })
  }
  if (need.anyOf !== undefined) {
    const { count, lessons } = need.anyOf
    const reached = SUBJECTS.filter(subject => lessonsOf(subject.key) >= lessons).length
    out.push({ kind: 'anyOf', text: `任意 ${count} 门课各 ${lessons} 节`, need: count, have: reached, met: reached >= count })
  }
  if (need.certificate !== undefined) {
    const interest = interestByKey(need.certificate)
    const have = pig.interests?.[need.certificate] ?? 0
    if (interest !== null) out.push({ kind: 'certificate', text: `${interest.emoji}${interest.certificate}`, need: CERTIFICATE_AFTER, have, met: have >= CERTIFICATE_AFTER })
  }
  return out
}

/**
 * Everything a job asks for that the pig does not have yet — all of it, not
 * just the first, so a locked job can say exactly why.
 * @param {{requires: JobRequires}|null} target
 * @param {{level: number, lessons: Record<string, number>, interests: Record<string, number>}} pig
 * @returns {{ok: boolean, missing: Condition[]}|null}
 */
export function jobRequirement(target, pig) {
  if (target === null || target === undefined) return null
  const missing = jobChecklist(target, pig).filter(condition => !condition.met)
  return { ok: missing.length === 0, missing }
}

/** The trait a job pays out on, spelled out for the panel. */
export const jobTrait = target => TRAITS[target.trait]
