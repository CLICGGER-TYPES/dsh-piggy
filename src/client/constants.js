// @ts-check
/**
 * 客户端常量：接口地址、面板尺寸、页签与游戏文案。
 *
 * 数值与文案集中在这里，渲染代码只引用名字（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/client/constants
 */


export const STATE_URL = '/dsh-piggy/state'
// Hand-drawn stages are served from the plugin's own /art route.
export const ART_URL = '/dsh-piggy/art/'
export const ACT_URL = '/dsh-piggy/act'
export const POLL_MS = 4000

/** How often the pig speaks up unprompted, in minutes (mirrors data/lines.js IDLE_CHAT_MINUTES). */
export const IDLE_CHAT_MINUTES = { min: 20, max: 40 }

/** Wait this long after the page opens before the pig says hello. */
export const GREET_DELAY_MS = 1500
export const MOUNTED = 'data-dsh-pig'
export const OPEN_KEY = 'dsh-piggy:open'
export const POSITION_KEY = 'dsh-piggy:position'
export const ICON_STYLE_KEY = 'dsh-piggy:icon-style'
// Must match `.dp-card{width}` — used to keep the panel inside the window.
export const PANEL_WIDTH = 292
export const PANEL_GAP = 8
export const PANEL_MARGIN = 10
export const PANEL_MIN_HEIGHT = 120
/**
 * 面板最高这么高：列表再长也在面板里滚动，不再把面板撑到整个屏幕那么高
 * （用户 2026-10-04 反馈）。主屏每页 9 个 App 放得下。
 */
export const PANEL_MAX_HEIGHT = 520
// Must match `--scene-open` in the CSS (a test keeps them honest). The pig
// is clamped against this rather than its collapsed height, so opening the
// panel can never shove the hud off the top of the window.
export const SCENE_RESERVE = 132
// Must match `.dp-scene{padding-inline}`. The pig's on-screen footprint is
// the glyph plus this padding; clamping by the glyph alone leaves it a few
// pixels over the edge.
export const PIG_PADDING_X = 6

export const TABS = [
  { key: 'status', label: '状态', emoji: '📋' },
  { key: 'card', label: '居民卡', emoji: '🪪' },
  { key: 'dex', label: '图鉴', emoji: '📖' },
  { key: 'skins', label: '换肤', emoji: '🎨' },
  { key: 'study', label: '学习', emoji: '📚' },
  { key: 'work', label: '打工', emoji: '💼' },
  { key: 'shop', label: '商店', emoji: '🛒' },
  { key: 'travel', label: '旅行', emoji: '🧳' },
  { key: 'bag', label: '背包', emoji: '🎒' },
  { key: 'pomodoro', label: '番茄钟', emoji: '🍅' },
  { key: 'fishing', label: '钓鱼', emoji: '🎣' },
  { key: 'extensions', label: '扩展', emoji: '🧩' },
  { key: 'settings', label: '设置', emoji: '⚙️' },
]

// 调试模式（C1）：主屏版本号连点 7 次解锁，只在内存里记住 —— 刷新就关。
// 原来靠 Ctrl+Shift+D + localStorage，用户看到的是「怎么关都关不掉」。
export const DEV_TAPS_TO_UNLOCK = 7
export const DEV_TAP_WINDOW_MS = 3000
/** 从第几次开始提示还差几下（前三次纯属手滑，不打扰）。 */
export const DEV_TAP_HINT_FROM = 4
export const DEV_TAP_HINT_MS = 1200
/** 启动时写死成 0：老版本存过的「已开」不能把调试模式带起来。 */
export const DEV_KEY = 'dsh-piggy:dev'
export const DEV_TAB = { key: 'dev', label: '调试', emoji: '🔧' }

/** 桌面版可热更新；DSH 里只提示 GitHub 有新版本。 */
export const UPDATE_TAB = { key: 'update', label: '更新', emoji: '🔄' }
/** 桌面版独有：关掉桌面上的猪（存档会先存好）。 */
export const QUIT_TAB = { key: 'quit', label: '退出', emoji: '👋' }

/** What the pig says when you pat it. A single line got old immediately. */
export const MODES = ['feed', 'bathe', 'play', 'pet']
export const CARE_LABEL = { feed: ['喂食', '🍎'], bathe: ['洗澡', '🛁'], play: ['玩耍', '🎾'], pet: ['摸摸', '❤️'] }
// What the pig says when the shelf it needs is bare. Being told plainly
// beats a generic "that did not work".
/** A new pig arrives in a box and has to be poked out of it. */
export const BOX_POKES_TO_OPEN = 3
export const BOX_POKE_LINES = [
  '里面好像有东西…',
  '动了！再戳一下！',
]

export const NO_ITEM_LINE = {
  food: '没有吃的啦，快去买一点 🍎',
  bath: '没有洗浴用品了，去买点吧 🧼',
  toy: '没有玩具了，去商店看看 🪀',
}
export const KIND_TITLE = { food: '🍎 食物', bath: '🧼 洗浴', toy: '🪀 玩具', bait: '🎣 鱼饵', dress: '👕 装扮', medicine: '💊 药品', revive: '✨ 复活', promotion: '✨ 晋升' }
export const KIND_ORDER = ['food', 'bath', 'toy', 'bait', 'medicine', 'promotion']

/** 物品放在哪个货架：还魂丹算药品（商店、背包、图鉴都一样）。 */
export function shelfOf(kind) {
  return kind === 'revive' || kind === 'body' ? 'medicine' : kind
}
export const STAGES = [
  { key: 'preschool', label: '幼儿园' },
  { key: 'extracurricular', label: '课外' },
  { key: 'primary', label: '小学' },
  { key: 'middle', label: '中学' },
  { key: 'high', label: '高中' },
  { key: 'college', label: '大学' },
  { key: 'graduate', label: '研究生' },
]
