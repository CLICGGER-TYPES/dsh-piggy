// @ts-check
/**
 * 用户审定的生图素材按已有状态与动作选用；这里只决定图片，不改变养成规则。
 * 同一状态的几张图按小时轮换，四秒轮询不会让立绘闪动。
 * @module dsh-piggy/client/feedback-art
 */

const MOOD_ART = {
  sick: ['collection-fever', 'allergy', 'runny-nose', 'collection-mosquito', 'collection-check'],
  hungry: ['hungry', 'collection-snack', 'collection-soup'],
  sleepy: ['sleep-cloud', 'lie-flat'],
  lonely: ['lie-flat', 'collection-cage', 'suspended'],
  dirty: ['collection-mosquito'],
  happy: ['birthday', 'collection-stack', 'music-rainbow', 'collection-throne'],
}

const REACTION_ART = {
  feed: ['collection-snack', 'collection-soup', 'hungry'],
  bathe: ['collection-bubbles'],
  play: ['collection-fitness', 'collection-chicken', 'turning'],
  pet: ['collection-stack', 'collection-badge'],
  cure: ['collection-check', 'faint'],
  levelup: ['collection-throne', 'birthday'],
}

const IDLE_ART = {
  roll: ['turning', 'collection-taro'],
  butterfly: ['collection-chicken', 'collection-scallion'],
  scratch: ['collection-mosquito', 'twitch'],
  stretch: ['collection-fitness', 'collection-scallion'],
  look: ['collection-letter', 'collection-cage'],
  bubbles: ['collection-bubbles', 'music-rainbow'],
  walk: ['collection-chicken', 'collection-scallion'],
}

const WORK_ART = {
  courier: 'courier', delivery: 'collection-courier', flyers: 'collection-letter',
  chef: 'collection-soup', singer: 'music-headphones-v2', songwriter: 'music-earbuds',
  cartoonist: 'painting', photographer: 'painting', athlete: 'collection-fitness',
  coach: 'collection-fitness', gardener: 'collection-scallion', florist: 'collection-scallion',
  guard: 'collection-cage', nurse: 'collection-check', doctor: 'collection-check',
  dancer: 'turning', ceo: 'collection-throne', star: 'music-rainbow',
}

// 原始生图里这些 PNG 是 RGB 白底；其余文件已经带透明通道。
export const OPAQUE_FEEDBACK_ART = new Set([
  'allergy', 'birthday', 'collection-badge', 'collection-courier', 'collection-soup',
  'collection-stack', 'courier', 'death-day', 'faint', 'fishing', 'ghost-grave',
  'hungry', 'lie-flat', 'music-earbuds', 'music-headphones-v2', 'music-rainbow',
  'recruit', 'runny-nose', 'sleep-cloud', 'study-book', 'study-determined',
  'study-pink-book', 'suspended', 'turning', 'twitch',
])

/** @param {string[]} options @param {number} hour */
function choose(options, hour) {
  return options[Math.abs(Math.floor(hour)) % options.length]
}

/** @param {{ stage: string, base: string, mood: string, reaction: string, idle: string, activityKind: string, activityKey: string, hour: number }} state */
export function feedbackArtFor(state) {
  if (state.stage === 'box') return 'courier'
  if (state.stage === 'dead-day') return 'death-day'
  if (state.stage === 'grave') return 'ghost-grave'
  // 专属形态与玩家导入的皮肤保持原有立绘和动作图。
  if (state.base && state.base !== 'piglet') return null
  if (REACTION_ART[state.reaction]) return choose(REACTION_ART[state.reaction], state.hour)
  if (state.mood === 'sick') return choose(MOOD_ART.sick, state.hour)
  if (state.mood === 'dirty') return choose(MOOD_ART.dirty, state.hour)
  if (state.activityKind === 'work' && WORK_ART[state.activityKey]) return WORK_ART[state.activityKey]
  if (state.activityKind === 'study') return choose(['study-book', 'study-pink-book', 'study-determined'], state.hour)
  if (state.activityKind === 'interest') {
    if (state.activityKey === 'fitness') return 'collection-fitness'
    if (state.activityKey === 'guitar' || state.activityKey === 'dancing') return choose(['music-earbuds', 'music-headphones-v2'], state.hour)
    if (state.activityKey === 'calligraphy' || state.activityKey === 'photography') return 'painting'
    return 'study-determined'
  }
  if (state.activityKind === 'fishing') return 'fishing'
  if (state.activityKind === 'trip') return choose(['collection-chicken', 'collection-taro', 'collection-scallion'], state.hour)
  if (IDLE_ART[state.idle]) return choose(IDLE_ART[state.idle], state.hour)
  if (MOOD_ART[state.mood]) return choose(MOOD_ART[state.mood], state.hour)
  return null
}
