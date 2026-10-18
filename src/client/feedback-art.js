// @ts-check
/**
 * 用户审定的生图素材按已有状态与动作选用；这里只决定图片，不改变养成规则。
 * 同一状态的几张图按小时轮换，四秒轮询不会让立绘闪动。
 * 对应关系 2026-10-09 由用户逐张调整过（生病按病种和阶段、生日蛋糕、待定图不用）。
 * @module dsh-piggy/client/feedback-art
 */

const MOOD_ART = {
  hungry: ['hungry'],
  lonely: ['lie-flat'],
  dirty: ['collection-mosquito'],
}

/** 生病按「病种:阶段」选图；没列出的病（咳嗽、肠胃、病危）保持原立绘加病色。 */
const ILLNESS_ART = {
  'cold:1': ['runny-nose'], 'cold:2': ['collection-fever'], 'cold:3': ['runny-nose'],
  'skin:1': ['allergy'], 'skin:2': ['allergy'], 'skin:3': ['allergy'], 'skin:4': ['allergy'],
  'dizzy:1': ['faint'], 'dizzy:2': ['faint'], 'dizzy:3': ['faint'],
}

/**
 * 开心、喂饭 / 洗澡 / 玩耍 / 升级时的反应、闲着时的小动作、旅行途中：先撤回，照常显示立绘和动作图
 * （用户 2026-10-13：三只猪叠在一起这类图影响体验，以后再看怎么解决）。原来的选图记在 WITHDRAWN_FEEDBACK_ART。
 */
const REACTION_ART = {}
const IDLE_ART = {}
export const WITHDRAWN_FEEDBACK_ART = Object.freeze({
  happy: ['music-rainbow', 'collection-stack'],
  feed: ['collection-snack', 'collection-soup'], bathe: ['collection-bubbles'], play: ['collection-chicken', 'turning'], levelup: ['collection-throne'],
  roll: ['turning', 'collection-taro'], butterfly: ['collection-chicken', 'collection-scallion'], look: ['collection-letter'], walk: ['collection-chicken', 'collection-scallion'],
  trip: ['collection-chicken', 'collection-taro', 'collection-scallion'],
})

const WORK_ART = {
  flyers: 'collection-letter', singer: 'music-headphones-v2', songwriter: 'music-earbuds',
  cartoonist: 'painting', athlete: 'collection-fitness', coach: 'collection-fitness',
  gardener: 'collection-scallion', florist: 'collection-scallion', ceo: 'collection-throne', star: 'music-rainbow',
}

const STAGE_ART = { box: ['courier', 'collection-courier'], 'dead-day': ['death-day'], grave: ['ghost-grave'] }
const STUDY_ART = ['study-book', 'study-pink-book', 'study-determined']
/** 兴趣班按课程选；没列出的课用 other。 */
const INTEREST_ART = {
  fitness: ['collection-fitness'], guitar: ['music-earbuds', 'music-headphones-v2'], dancing: ['music-earbuds', 'music-headphones-v2'],
  calligraphy: ['painting'], photography: ['painting'], other: ['study-determined'],
}
const TRIP_ART = []
/** 生日当天点了头顶的蛋糕，短暂显示这张。 */
export const BIRTHDAY_ART = 'birthday'

/** 每类场景用哪些图（调试页「立绘」按它列出每张图用在哪）。 */
export const FEEDBACK_ART_TABLES = Object.freeze({
  stage: STAGE_ART, birthday: [BIRTHDAY_ART], reaction: REACTION_ART, illness: ILLNESS_ART, mood: MOOD_ART, work: WORK_ART,
  study: STUDY_ART, interest: INTEREST_ART, fishing: ['fishing'], trip: TRIP_ART, idle: IDLE_ART,
})

/** 审定过但暂时不用的图（用户 2026-10-09：待定或不合适），留在仓库里备用。 */
export const UNUSED_FEEDBACK_ART = Object.freeze(['collection-badge', 'collection-check', 'collection-cage', 'suspended', 'twitch',
  // 2026-10-18：困了/睡着改用当前皮肤自己的 sleep 图，不再用这张反馈图。
  'sleep-cloud'])

/** @param {string[]} options @param {number} hour */
function choose(options, hour) {
  return options[Math.abs(Math.floor(hour)) % options.length]
}

/** @param {{ stage: string, base: string, mood: string, reaction: string, idle: string, activityKind: string, activityKey: string, illness?: string, party?: boolean, hour: number }} state */
export function feedbackArtFor(state) {
  if (STAGE_ART[state.stage]) return choose(STAGE_ART[state.stage], state.hour)
  // 生日蛋糕是一幅场景图，胖瘦形态、皮肤都照样显示。
  if (state.party === true) return BIRTHDAY_ART
  // 专属形态与玩家导入的皮肤保持原有立绘和动作图。
  if (state.base && state.base !== 'piglet') return null
  if (REACTION_ART[state.reaction]) return choose(REACTION_ART[state.reaction], state.hour)
  if (state.mood === 'sick') return ILLNESS_ART[state.illness ?? ''] ? choose(ILLNESS_ART[state.illness ?? ''], state.hour) : null
  if (state.mood === 'dirty') return choose(MOOD_ART.dirty, state.hour)
  if (state.activityKind === 'work') return WORK_ART[state.activityKey] ?? null
  if (state.activityKind === 'study') return choose(STUDY_ART, state.hour)
  if (state.activityKind === 'interest') return choose(INTEREST_ART[state.activityKey] ?? INTEREST_ART.other, state.hour)
  if (state.activityKind === 'fishing') return 'fishing'
  if (state.activityKind === 'trip') return TRIP_ART.length ? choose(TRIP_ART, state.hour) : null
  if (IDLE_ART[state.idle]) return choose(IDLE_ART[state.idle], state.hour)
  if (MOOD_ART[state.mood]) return choose(MOOD_ART[state.mood], state.hour)
  return null
}
