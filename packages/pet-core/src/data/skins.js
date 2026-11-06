// @ts-check

export const SKIN_SCENES = Object.freeze(['idle', 'eat', 'bathe', 'play', 'pet', 'relaxed', 'work', 'study', 'trip', 'fish', 'sleep'])
export const REQUIRED_SKIN_SCENES = Object.freeze(SKIN_SCENES.slice(0, 5))
/** The supplied character pack has all nine poses except fishing. */
const CHARACTER_SCENES = Object.freeze(SKIN_SCENES.filter(scene => scene !== 'fish' && scene !== 'sleep'))

export const SKINS = Object.freeze([
  Object.freeze({
    key: 'mint', label: '薄荷小猪', emoji: '🌿', art: 'skin-mint',
    author: 'dsh-piggy', description: '像一口薄荷汽水，清清凉凉。',
    scenes: Object.freeze(['idle', 'eat', 'bathe', 'play', 'pet', 'work']), custom: false,
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
  Object.freeze({
    key: 'postman', label: '邮差猪', emoji: '📮', art: 'skin-postman', unlockJob: 'courier',
    author: 'dsh-piggy', description: '每一封信都要送到该去的地方。',
    hint: '把第一份快递送到门口，邮包就会留下来。',
    scenes: SKIN_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'gardener', label: '园丁猪', emoji: '🌱', art: 'skin-gardener', unlockJob: 'gardener',
    author: 'dsh-piggy', description: '草帽底下藏着一整个春天。',
    hint: '在菜园里完成第一班园丁工作，草帽就会留下来。',
    scenes: SKIN_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'raincoat', label: '雨衣猪', emoji: '💧', art: 'skin-raincoat',
    author: 'dsh-piggy', description: '下雨天也要出门踩水。',
    scenes: SKIN_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'painter', label: '画家猪', emoji: '🎨', art: 'skin-painter',
    author: 'dsh-piggy', description: '今天的心情是调色盘上的哪一种？',
    scenes: SKIN_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'firefighter', label: '消防员猪', emoji: '🔥', art: 'skin-firefighter',
    author: 'dsh-piggy', description: '小火苗看到它就跑。',
    scenes: SKIN_SCENES, custom: false,
  }),
  Object.freeze({
    key: 'musician', label: '音乐家猪', emoji: '🎵', art: 'skin-musician',
    author: 'dsh-piggy', description: '走路都带着自己的背景音乐。',
    scenes: SKIN_SCENES, custom: false,
  }),
])

export function skinByKey(key) {
  return SKINS.find(skin => skin.key === key) ?? null
}
