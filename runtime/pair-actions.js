// @ts-check
/**
 * 配对接口的白名单：面板动作、斜杠命令和强制终结目标。
 *
 * 桌面侧的第二道校验；DSH 客户端被改也绕不过。禁止项永远不出现在这里：
 * dev / giveAll / reset / ageFromNow / timeScale / fishGive / 扩展安装删除 /
 * 存档导入导出 / 皮肤导入 / 日志。
 *
 * @module dsh-piggy/runtime/pair-actions
 */

export const PAIR_ACTIONS = Object.freeze([
  'hatch', 'adopt', 'feed', 'bathe', 'play', 'pet',
  // 拖动/摸一下会发后台 touch：只刷新活跃时间，不消耗物品；core 对纸盒/墓碑回 silent。
  'touch',
  'reply', 'signIn', 'openGift',
  'pomodoro', 'pomodoroAbandon', 'quiet', 'offlineFeed', 'owner', 'catchphrase', 'motto',
  'editProfile', 'crown', 'name', 'work', 'study', 'interest', 'trip',
  'fishCast', 'fishHook', 'fishResolve', 'fishKeep', 'fishFeed', 'fishSell', 'fishRod',
  'fishAutomation', 'fishCollect', 'fishSpot', 'fishAuto', 'fishSkip',
  'exchange', 'skin', 'calloff', 'buy', 'use', 'doctor', 'sell', 'wear', 'ext',
  'setExtension', 'chat',
])

export const PAIR_ACTION_SET = new Set(PAIR_ACTIONS)

/** 与 commands.js 的公开动词一致（含 mo / travel 两个别名）；新动词必须两边同时加。 */
export const PAIR_COMMAND_VERBS = Object.freeze([
  'status', 'hatch', 'feed', 'bathe', 'play', 'pet', 'mo', 'work', 'study', 'trip', 'travel',
  'calloff', 'shop', 'buy', 'use', 'interest', 'sell', 'wear', 'adopt', 'reply', 'weigh',
  'name', 'crown', 'about', 'help',
])

export const PAIR_COMMAND_SET = new Set(PAIR_COMMAND_VERBS)

export const PREPARE_TARGETS = Object.freeze(['activity', 'pomodoro', 'fishing'])

/** 明确禁止的动作：测试据此确认桌面侧没有放行。 */
export const DENIED_ACTIONS = Object.freeze([
  'dev', 'giveAll', 'reset', 'ageFromNow', 'timeScale', 'fishGive', 'installExtension', 'removeExtension',
])

/** 命令动词只取第一个词；不认识的动词一律拒绝。 */
export function commandVerb(input) {
  const text = typeof input === 'string' ? input.trim() : ''
  return text === '' ? 'status' : text.split(/\s+/)[0].toLowerCase()
}
