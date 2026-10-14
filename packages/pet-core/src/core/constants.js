// @ts-check
/**
 * 领域常量与动作表。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/constants
 */

/** Bumped when the saved shape changes in a way migrate() must handle. */
export const STATE_VERSION = 13

export const BIRTH_WEIGHT_G = 1200

export const HATCH_WEIGHT_G = 160

export const MEMORY_LIMIT = 8

export const PENDING_LIMIT = 6

/** Growth ladder, ascending by xp. */
/**
 * Growth ladder, ascending by xp.
 *
 * Tuned so that ordinary passive work alone takes roughly: 7 minutes to 小猪崽,
 * 40 minutes to 圆滚猪, an afternoon to 大猪猪, a few days to 猪皇, a week or so
 * to 猪王, and the best part of a month of real use to 野猪王. Sending the pig
 * out to work or study is worth several hours of watching you type, so playing
 * the game is the fast lane.
 */

/**
 * Passive diet — what the pig gets for watching you actually work. Growth from
 * real work is separate and capped per day (data/growth.js DSH_GROWTH).
 *
 * These numbers are deliberately small. A single tool call used to be worth 3,
 * and a heavy agent session fires hundreds of them an hour: one afternoon of
 * ordinary use was 2232 XP, 94% of the whole pig, and it hit 「猪皇」 without the
 * player ever sending it to work or school. Passive work is now a trickle; the
 * activities are where the growth is.
 */
export const DIET = Object.freeze({
  message: { satiety: 1, happiness: 1, weightG: 6 },
  turn: { satiety: 2, happiness: 1, weightG: 14 },
  tool: { satiety: 2, happiness: 0, weightG: 9 },
  toolError: { satiety: 0, happiness: 1, weightG: 2 },
  agentError: { satiety: 0, happiness: 0, weightG: 2 },
})

export const ACTIONS = Object.freeze({
  feed: {
    key: 'feed', label: '喂食', emoji: '🍎', verb: '吃了一口 🍎',
    // No blanket cleanliness hit: eating an apple does not make you dirty. Only
    // the foods that are actually messy declare a penalty of their own.
    // No cooldown (owner, 2026-10-01): every bite already costs a food item,
    // and feeding a full pig risks a stomach ache (B3) — that is the brake.
    cooldownMs: 0, satiety: 22, happiness: 6, cleanliness: 0, weightG: 90,
  },
  bathe: {
    key: 'bathe', label: '洗澡', emoji: '🛁', verb: '洗了个澡 🛁',
    cooldownMs: 0, satiety: -1, happiness: 8, cleanliness: 50, weightG: 0,
  },
  play: {
    key: 'play', label: '玩耍', emoji: '🎾', verb: '玩了一会儿 🎾',
    cooldownMs: 0, satiety: -5, happiness: 16, cleanliness: -2, weightG: 4,
  },
  pet: {
    key: 'pet', label: '摸摸', emoji: '❤️', verb: '被摸了摸头 ❤️',
    cooldownMs: 0, satiety: 0, happiness: 10, cleanliness: 0, weightG: 0,
  },
})

export const ACTION_ORDER = Object.freeze(['feed', 'bathe', 'play', 'pet'])

// Tuned against the activity lengths, not against minutes. A four-hour shift
// now costs roughly one meal and one bath, which is recoverable; the old rates
// were written when a shift was ten minutes and emptied every bar twice over.
export const SATIETY_DECAY_PER_MIN = 0.08

// G2（用户 2026-10-05 确认）：心情每小时 3.6 → 2.4，清洁 4.2 → 3.6。
export const HAPPINESS_DECAY_PER_MIN = 0.04

export const CLEANLINESS_DECAY_PER_MIN = 0.06

export const AWAY_DECAY_MULTIPLIER = 1.4

/** No single trip may push a bar below this — see the drain() comment in decay. */
export const AWAY_FLOOR = 15

export const DAY_MS = 86_400_000

/**
 * The longest single step decay() takes. Long absences are walked in steps of
 * this size so thresholds are crossed when they really were; five minutes keeps
 * a month offline under ten thousand cheap steps.
 */
export const SETTLE_STEP_MS = 5 * 60_000

/**
 * 单次结算能回溯的最长时间（400 天）。
 *
 * 正常玩法里离开的时长由真实时钟决定；这里防的是「有限但久远」的坏游标：手改存档、
 * 跨机器拷贝、或时钟被拨到过去又拨回，都可能让 `lastSeenAt` 落在很久以前。若不设上限，
 * 结算按 SETTLE_STEP_MS 逐步走，时间差多大就要走多少步，面板线程会卡死（存档模糊测试 4.1）。
 * 上限取 400 天：远大于任何真实离开（100 天以内都照常结算），又能把单次步数钉在 12 万步
 * 以内。超出部分不补结算——那段时间猪当作没有离开过，见 core/settlement.js 的 decay()。
 */
export const MAX_SETTLE_SPAN_MS = 400 * DAY_MS

/**
 * 结算步长的下限（毫秒）。
 *
 * passTime 平时按 SETTLE_STEP_MS 走；离线喂食开着时会把步长压到「饱食刚好掉到饥饿线」
 * 那一刻，好让猪在该吃的时刻吃。原先下限是 1 毫秒，一旦浮点残差让这个差值只剩几毫秒，
 * 单次结算的步数就会变成「跨度 / 1ms」量级（400 天 = 三千多万步，面板卡死）。抬到 1 秒
 * 既保住了「压在饥饿线上」的精度，又把最坏步数压回去（P2-3 第 7 条）。
 */
export const MIN_SETTLE_STEP_MS = 1000

/**
 * 单次结算的步数上限（passTime 的守卫）。
 *
 * 只是防「步长被压到下限时无限循环」这类回归：正常路径最多 400 天 / 5 分钟 ≈ 11.5 万步，
 * 远在守卫之下；触发说明出现了异常输入，放弃剩余时间并记一条日志，不硬撑。
 */
export const MAX_SETTLE_STEPS = 200_000

/**
 * 时钟回拨的容忍时长。
 *
 * 对表（NTP、夏令时、虚拟机挂起）把墙上时钟往回拨一点是常事，这时结算游标必须留在
 * 高点：拖回去就等于把已经结算过的离线时间再结算一遍（重复喂食、重复长大、重掷疾病）。
 * 但「用户把系统时间调成错的」（笔记本没电池、手动改表）从存档上看和回拨一模一样，
 * 一直保留游标会让猪无限期冻在未来，所以倒退持续满这个时长（按倒退后的新时钟计）
 * 就认新时钟当新起点、跳过去且不补结算——回拨出来的那段本来就没真的流过。
 *
 * 效果：回拨不超过一天，猪冻结到真实时间追上原游标（最多一天）；回拨超过一天，
 * 冻结满一天后接受新时间点。
 */
export const CLOCK_ROLLBACK_HOLD_MS = 24 * 60 * 60_000

/**
 * Health at or below which the pig is too weak to leave the house. The scale is
 * 5 = full, and the four illness stages set it to 4/3/2/1, so 1 is the last
 * stage before it dies.
 */
export const TOO_WEAK_HEALTH = 1

export const AWAY_MOODS = Object.freeze({
  work: { key: 'working', emoji: '💼', label: '在打工' },
  study: { key: 'studying', emoji: '📚', label: '在上课' },
  trip: { key: 'traveling', emoji: '🧳', label: '在旅行' },
  interest: { key: 'studying', emoji: '💻', label: '在兴趣课' },
})
