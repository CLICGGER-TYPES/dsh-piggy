// @ts-check
/**
 * 九门课与课时学段 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 数字全部来自 docs/numbers/B4-study-jobs.md（用户 2026-10-01 确认）。
 * 照 QQ 宠物怀旧服 GrowUp.js：九门课各算各的课时，一门课上到第 9 / 20 / 40 / 95 节
 * 就算这门课小学 / 中学 / 大学 / 研究生毕业，不需要九门一起升。
 *
 * @module dsh-piggy/data/school
 */

/**
 * @typedef {object} Subject
 * @property {string} key
 * @property {string} label
 * @property {string} emoji
 * @property {'intel'|'charm'|'strong'} trait - 主要涨的属性
 * @property {'intel'|'charm'|'strong'|null} secondary - 顺带涨的属性
 */

/**
 * @param {string} key
 * @param {string} label
 * @param {string} emoji
 * @param {'intel'|'charm'|'strong'} trait
 * @param {'intel'|'charm'|'strong'|null} [secondary]
 * @returns {Subject}
 */
const subject = (key, label, emoji, trait, secondary = null) => Object.freeze({ key, label, emoji, trait, secondary })

/** @type {ReadonlyArray<Subject>} */
export const SUBJECTS = Object.freeze([
  subject('chinese', '语文', '📖', 'intel', 'charm'),
  subject('mathematics', '数学', '🔢', 'intel'),
  subject('politics', '政治', '⚖️', 'intel', 'strong'),
  subject('music', '音乐', '🎵', 'charm'),
  subject('art', '艺术', '🎨', 'charm', 'intel'),
  subject('manners', '礼仪', '🎩', 'charm'),
  subject('pe', '体育', '🏃', 'strong', 'charm'),
  subject('labour', '劳技', '🔧', 'strong', 'intel'),
  subject('wushu', '武术', '🥋', 'strong'),
])

export const subjectByKey = key => SUBJECTS.find(entry => entry.key === key) ?? null

/**
 * @typedef {object} SchoolStage
 * @property {string} key
 * @property {string} label
 * @property {string} emoji
 * @property {number} upTo - 这门课上到第几节还算这个学段（含）；最后一档是 Infinity
 * @property {number} minutes - 每节时长
 * @property {number} tuition - 每节学费
 * @property {number} gain - 主属性 +
 * @property {number} secondaryGain - 顺带属性 +
 * @property {number} satiety - 每节消耗饱食
 * @property {number} happiness - 每节消耗心情
 */

/**
 * Where a subject is, by how many lessons of it the pig has taken. Lesson N
 * belongs to the first stage whose `upTo` is ≥ N; finishing the lesson numbered
 * exactly `upTo` is that stage's graduation.
 * @type {ReadonlyArray<SchoolStage>}
 */
export const SCHOOL_STAGES = Object.freeze([
  Object.freeze({ key: 'primary', label: '小学', emoji: '📚', upTo: 9, minutes: 20, tuition: 10, gain: 1, secondaryGain: 0, satiety: -5, happiness: -1 }),
  Object.freeze({ key: 'middle', label: '中学', emoji: '🏫', upTo: 20, minutes: 30, tuition: 25, gain: 2, secondaryGain: 1, satiety: -7, happiness: -2 }),
  Object.freeze({ key: 'college', label: '大学', emoji: '🏛', upTo: 40, minutes: 45, tuition: 60, gain: 3, secondaryGain: 1, satiety: -10, happiness: -3 }),
  Object.freeze({ key: 'graduate', label: '研究生', emoji: '🔬', upTo: 95, minutes: 60, tuition: 120, gain: 4, secondaryGain: 2, satiety: -12, happiness: -4 }),
  Object.freeze({ key: 'beyond', label: '学无止境', emoji: '🌌', upTo: Infinity, minutes: 60, tuition: 150, gain: 5, secondaryGain: 2, satiety: -12, happiness: -4 }),
])

/** Lesson counts that end a stage: finishing one of these is a graduation. */
export const GRADUATION_LESSONS = Object.freeze(SCHOOL_STAGES.filter(stage => Number.isFinite(stage.upTo)).map(stage => stage.upTo))

export const schoolStageByKey = key => SCHOOL_STAGES.find(stage => stage.key === key) ?? null

/**
 * The stage the *next* lesson of a subject belongs to, given how many have been
 * taken. 0 taken → lesson 1 → 小学; 9 taken → lesson 10 → 中学.
 * @param {number} taken
 * @returns {SchoolStage}
 */
export function stageForNextLesson(taken) {
  const lesson = Math.max(0, Math.floor(Number.isFinite(taken) ? taken : 0)) + 1
  return SCHOOL_STAGES.find(stage => lesson <= stage.upTo) ?? SCHOOL_STAGES[SCHOOL_STAGES.length - 1]
}

/**
 * The stage a subject has *finished*, or null before its first graduation.
 * @param {number} taken
 * @returns {SchoolStage|null}
 */
export function graduatedStage(taken) {
  let done = null
  for (const stage of SCHOOL_STAGES) if (Number.isFinite(stage.upTo) && taken >= stage.upTo) done = stage
  return done
}
