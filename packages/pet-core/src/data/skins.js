// @ts-check

export const SKIN_SCENES = Object.freeze(['idle', 'eat', 'bathe', 'play', 'pet', 'relaxed', 'work', 'study', 'trip', 'fish', 'sleep'])
export const REQUIRED_SKIN_SCENES = Object.freeze(SKIN_SCENES.slice(0, 5))
/** The supplied character pack has all nine poses except fishing. */
const CHARACTER_SCENES = Object.freeze(SKIN_SCENES.filter(scene => scene !== 'fish' && scene !== 'sleep'))

export const SKINS = Object.freeze([
  Object.freeze({
    key: 'mint', label: '薄荷小猪', emoji: '🌿', art: 'skin-mint',
    author: 'dsh-piggy', description: '像一口薄荷汽水，清清凉凉。',
    scenes: Object.freeze(['idle', 'eat', 'bathe', 'play', 'pet']), custom: false,
  }),
  Object.freeze({
    key: 'chef', label: '厨师猪', emoji: '👨‍🍳', art: 'career-chef', unlockJob: 'chef',
    author: 'dsh-piggy', description: '掌勺归来，帽子上还沾着一点面粉。',
    hint: '厨房里的第一班烟火，会送来一顶白帽子。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'astronaut', label: '宇航员猪', emoji: '🚀', art: 'career-astronaut', unlockJob: 'astronaut',
    author: 'dsh-piggy', description: '把地球装进头盔的倒影里。',
    hint: '完成那趟离天空最近的工作，才有资格戴上头盔。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'detective', label: '侦探猪', emoji: '🔎', art: 'skin-detective',
    author: 'dsh-piggy', description: '小线索总躲不过它的眼睛。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'angel', label: '天使猪', emoji: '😇', art: 'skin-angel',
    author: 'dsh-piggy', description: '光环很亮，脾气还是软软的。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'pirate', label: '海盗猪', emoji: '🏴‍☠️', art: 'skin-pirate',
    author: 'dsh-piggy', description: '出门找宝藏，回家找晚饭。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'wizard', label: '巫师猪', emoji: '🪄', art: 'skin-wizard',
    author: 'dsh-piggy', description: '帽子里没有魔法，只有好奇心。',
    scenes: CHARACTER_SCENES, custom: false,
  }),
])

export function skinByKey(key) {
  return SKINS.find(skin => skin.key === key) ?? null
}
