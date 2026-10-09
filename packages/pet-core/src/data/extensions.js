// @ts-check
/**
 * 扩展注册表：可以整体开关、关掉后不影响其他玩法的玩法模块（设计见 docs/design/extension-center.md）。
 *
 * 每个扩展声明自己占了哪些地方，关掉时这些地方一起消失：
 *   apps        主菜单格子 / 图标栏 / App 页
 *   actions     路由动作（关闭后一律拒绝）
 *   dexSections 图鉴分区
 *   shopKinds   商店里的商品种类（关闭后从商店撤下；背包里已有的照常保留）
 *   builtin     代码在游戏里：删掉后「重新安装」不用下载（见 docs/design/extension-download.md）
 * 以后种菜、盲盒、小游戏照这个格式加一条。
 */
export const EXTENSIONS = Object.freeze([
  Object.freeze({
    key: 'pomodoro',
    label: '番茄钟',
    emoji: '🍅',
    description: '专注 15 / 25 / 45 分钟，猪安静陪着你，每完成一个都有奖励。',
    defaultOn: true,
    builtin: true,
    apps: Object.freeze(['pomodoro']),
    actions: Object.freeze(['pomodoro', 'pomodoroAbandon']),
    dexSections: Object.freeze([]),
    shopKinds: Object.freeze([]),
  }),
  Object.freeze({
    key: 'fishing',
    label: '钓鱼',
    emoji: '🎣',
    description: '抛竿、看准时机提竿，钓到的鱼进鱼篓，可以喂猪或卖钱；也能让猪自己出门钓。',
    defaultOn: true,
    builtin: true,
    apps: Object.freeze(['fishing']),
    actions: Object.freeze(['fishCast', 'fishHook', 'fishResolve', 'fishKeep', 'fishAuto', 'fishGive', 'fishSkip']),
    dexSections: Object.freeze(['fish']),
    shopKinds: Object.freeze(['bait']),
  }),
])

/** @param {string} key */
export function extensionByKey(key) {
  return EXTENSIONS.find(extension => extension.key === key) ?? null
}

/** 某个路由动作属于哪个扩展；不属于任何扩展返回 null。 @param {string} action */
export function extensionForAction(action) {
  return EXTENSIONS.find(extension => extension.actions.includes(action)) ?? null
}
