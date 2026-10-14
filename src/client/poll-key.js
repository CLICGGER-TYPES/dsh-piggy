// @ts-check
/**
 * 轮询短路：这次拿到的快照，和上次画出来的比，「画面上一样」吗？
 *
 * 4 秒一次轮询会把整块内容拆了重建（菜园一屏 160 个节点、52 张图）。快照里却有一批字段
 * 每次请求都在变、画面上根本看不出来——时间戳、按毫秒走的生长期、帮工计时。
 * 这里把它们压到**界面真正画出来的精度**再比：一模一样就不用重画，悬停卡、开着的弹层、
 * 手里拿的工具也就不会被顺手抹掉（见 io.js 的 refresh / panel.js 的 paintContent）。
 *
 * 精度取的就是显示精度，所以不会把该更新的数字压掉：
 *   - 菜园背景只按小时换（client.js 的 sceneArt 用 getHours）；
 *   - 剩余时间按分钟向上取整（shortTime）——量化后画出来的分钟数一模一样；
 *   - 进度按整百分比画（悬停卡进度条，`Math.round(progress * 100)`）。
 * 没写表的字段一律原样比：表里漏了只会让短路少生效（照旧每 4 秒重画一次），不会画错。
 * test/poll-key.test.js 用真的 farm.view() 前后 4 秒的快照守住这一点。
 *
 * 表为什么在宿主里：改菜园的 client.js / server.js 要重新发一个扩展包（玩家得等下载），
 * 而 600 行的硬上限也放不下（CONVENTIONS §文件行数）；宿主跟着游戏更新，改这里就能生效。
 * 以后有了「扩展自己声明哪些字段按什么精度看」的位置，这段就该搬过去。
 * @module dsh-piggy/client/poll-key
 */

/** 扩展 view 里「每 4 秒都在变、画面上看不出来」的字段，按扩展 key 列出。 */
var VIEW_RULES = {
  farm: {
    now: function (ms) { return Math.floor(ms / 3600000) },
    remainingMs: function (ms) { return Math.ceil(ms / 60000) },
    progress: function (percent) { return Math.round(percent * 100) },
    usedHours: function () { return 0 },
  },
}

/**
 * 递归把一份 view 压到画面精度（返回新对象，不动快照本身）。
 * @param {any} value
 * @param {Record<string, (value: number) => number>} rules
 * @returns {any}
 */
function fold(value, rules) {
  if (Array.isArray(value)) return value.map(function (item) { return fold(item, rules) })
  if (value === null || typeof value !== 'object') return value
  var out = {}
  for (var key in value) {
    var rule = rules[key]
    out[key] = rule !== undefined && typeof value[key] === 'number' ? rule(value[key]) : fold(value[key], rules)
  }
  return out
}

/** 只换掉扩展 view 里要压的那几处；没有表的一律原样。 */
function foldViews(views) {
  if (views === null || typeof views !== 'object') return views
  var out = {}
  for (var key in views) out[key] = VIEW_RULES[key] ? fold(views[key], VIEW_RULES[key]) : views[key]
  return out
}

/**
 * 一份快照的「画面指纹」：指纹一样，面板就不用重画。
 * @param {any} snapshot 宿主 /state 的正文（JSON.parse 之后）
 * @returns {string}
 */
export function pollKey(snapshot) {
  if (snapshot === null || typeof snapshot !== 'object') return String(snapshot)
  var copy = Object.assign({}, snapshot)
  copy.extViews = foldViews(snapshot.extViews)
  return JSON.stringify(copy)
}
