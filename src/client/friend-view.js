// @ts-check
/**
 * 把房间里的朋友资料拼成一份「和本地猪同形状」的只读 view。
 * 面板的 status / card 渲染函数直接用它，不再维护第二套朋友 UI。
 */

function number(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 朋友的行动就绪状态；旧版房间没带 actions 时按全部就绪处理，目标端仍会兜底。 */
function actionsOf(friend) {
  const source = friend?.actions && typeof friend.actions === 'object' ? friend.actions : {}
  const out = {}
  for (const key of ['feed', 'bathe', 'play', 'pet']) {
    const entry = source[key] && typeof source[key] === 'object' ? source[key] : {}
    out[key] = {
      ready: entry.ready !== false,
      waitSeconds: number(entry.waitSeconds, 0),
      blocked: entry.blocked === 'away' || entry.blocked === 'hungry' ? entry.blocked : null,
    }
  }
  return out
}

/** @param {any} view @param {any} friend */
export function friendViewOf(view, friend) {
  const status = friend?.status && typeof friend.status === 'object' ? friend.status : {}
  const card = friend?.card && typeof friend.card === 'object' ? friend.card : null
  const level = status.level && typeof status.level === 'object'
    ? status.level
    : { level: number(friend?.level, 1), percent: 0, toNext: 0, maxed: false, titleEmoji: '', titleLabel: '' }
  const care = friend?.care && typeof friend.care === 'object' ? friend.care : {}
  const art = typeof friend?.art === 'string' && friend.art !== '' ? friend.art : null
  return {
    ...view,
    // 朋友的行动状态来自房间资料；care 仍用本机 view 的背包，因为照顾消耗客人的物品。
    actions: actionsOf(friend),
    maxHealth: number(status.maxHealth, 5),
    profile: card === null ? null : { ...card, birthdayParts: card.birthdayParts ?? null, personalities: [] },
    forms: null,
    dialogue: { ownerName: '' },
    pig: {
      artUrl: art === null ? '' : '/dsh-piggy/art/' + art,
      name: typeof friend?.name === 'string' ? friend.name : '小猪',
      stage: {
        key: typeof friend?.stage === 'string' ? friend.stage : 'piglet',
        label: typeof friend?.label === 'string' ? friend.label : '',
        emoji: typeof friend?.emoji === 'string' ? friend.emoji : '🐖',
        art,
      },
      level,
      satiety: number(care.satiety, 60),
      happiness: number(care.happiness, 60),
      cleanliness: number(care.cleanliness, 60),
      health: number(status.health, 5),
      healthPercent: number(status.healthPercent, 100),
      traits: status.traits && typeof status.traits === 'object'
        ? status.traits
        : { intel: 0, charm: 0, strong: 0 },
      weight: typeof status.weight === 'string' ? status.weight : '',
      bodyWeight: status.bodyWeight ?? null,
      mood: typeof status.mood === 'string' ? status.mood : '',
      moodLabel: typeof status.moodLabel === 'string' ? status.moodLabel : '开心',
      memories: [],
      coins: 0,
      dead: false,
      soul: false,
      illness: status.illness ?? null,
    },
  }
}
